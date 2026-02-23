import { ScraperService } from "@/lib/services/ScraperService";
import { prisma } from "@/lib/db";
import { CryptoService } from "@/lib/services/CryptoService";
import { cookies } from "next/headers";

// Remove in-memory scraperCache

export async function getScraperForSession(): Promise<ScraperService> {
  const cookieStore = await cookies();
  const userIdCookie = cookieStore.get("auth_session");

  if (!userIdCookie) {
    throw new Error("No active session");
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
    throw new Error("Itslearning credentials not configured");
  }

  const scraper = new ScraperService(
    user.itslearningUrl || "https://sdu.itslearning.com",
  );

  const password = CryptoService.decrypt(
    user.itslearningPwd,
    user.itslearningIv,
  );

  scraper.onAuthFailure = async () => {
    console.log("Token expired/invalid (401). Re-authenticating...");
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
