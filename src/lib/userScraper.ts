import { ScraperService } from "@/lib/services/ScraperService";
import { prisma } from "@/lib/db";
import { CryptoService } from "@/lib/services/CryptoService";
import { cookies } from "next/headers";

// Remove in-memory scraperCache
const AUTH_SESSION_ERROR = "No active session";

export function isAuthSessionError(error: unknown): boolean {
  return error instanceof Error && error.message === AUTH_SESSION_ERROR;
}

function authSessionError() {
  return new Error(AUTH_SESSION_ERROR);
}

function decryptStoredPassword(encryptedPwd: string, iv: string): string {
  try {
    return CryptoService.decrypt(encryptedPwd, iv);
  } catch (error) {
    console.warn(
      "Stored itslearning credentials could not be decrypted; login is required.",
      error,
    );
    throw authSessionError();
  }
}

export async function getScraperForSession(): Promise<ScraperService> {
  const cookieStore = await cookies();
  const userIdCookie = cookieStore.get("auth_session");

  if (!userIdCookie) {
    throw authSessionError();
  }

  const userId = parseInt(userIdCookie.value);

  // Load from DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      itslearningUser: true,
      itslearningPwd: true,
      itslearningIv: true,
      itslearningUrl: true,
      itslearningAccessToken: true,
      itslearningTokenExpiresAt: true,
    },
  });

  if (
    !user ||
    !user.itslearningUser ||
    !user.itslearningPwd ||
    !user.itslearningIv
  ) {
    throw authSessionError();
  }

  const scraper = new ScraperService(
    user.itslearningUrl || "https://sdu.itslearning.com",
  );

  scraper.onAuthFailure = async () => {
    console.log("Token expired/invalid (401). Re-authenticating...");
    const password = decryptStoredPassword(
      user.itslearningPwd as string,
      user.itslearningIv as string,
    );

    await scraper.authenticate(user.itslearningUser as string, password);

    await prisma.user.update({
      where: { id: userId },
      data: {
        itslearningAccessToken: scraper.getAccessToken(),
        itslearningTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 50),
      },
    });
  };

  // Check DB cache
  if (
    user.itslearningAccessToken &&
    user.itslearningTokenExpiresAt &&
    user.itslearningTokenExpiresAt.getTime() > Date.now()
  ) {
    scraper.setAccessToken(user.itslearningAccessToken);
    return scraper;
  }

  // Initial Auth
  await scraper.onAuthFailure();

  return scraper;
}
