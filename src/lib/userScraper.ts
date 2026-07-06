import { ScraperService } from "@/lib/services/ScraperService";
import { prisma } from "@/lib/db";
import { CryptoService } from "@/lib/services/CryptoService";
import { getSessionUserId } from "@/lib/session";

// Remove in-memory scraperCache
const AUTH_SESSION_ERROR = "No active session";

// In-process dedupe lock: several requests for the same user that all find an
// expired token would otherwise each run a separate OAuth round-trip and DB
// write (auth stampede / token thrash). Keyed by userId, cleared once settled.
const authLocks = new Map<number, Promise<string>>();

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

// Authenticate at most once per user even under concurrency: the first caller
// performs the OAuth round-trip and persists the token; concurrent callers
// await the same promise and reuse the resulting token.
function getFreshAccessToken(
  userId: number,
  url: string,
  username: string,
  password: string,
): Promise<string> {
  const existing = authLocks.get(userId);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const scraper = new ScraperService(url);
    await scraper.authenticate(username, password);
    const token = scraper.getAccessToken();

    await prisma.user.update({
      where: { id: userId },
      data: {
        itslearningAccessToken: token,
        itslearningTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 50),
      },
    });

    return token;
  })();

  authLocks.set(userId, pending);

  return pending.finally(() => {
    authLocks.delete(userId);
  });
}

export async function getScraperForSession(): Promise<ScraperService> {
  const userId = await getSessionUserId();

  if (userId === null) {
    throw authSessionError();
  }

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

  const url = user.itslearningUrl || "https://sdu.itslearning.com";
  const username = user.itslearningUser;
  const encryptedPwd = user.itslearningPwd;
  const iv = user.itslearningIv;

  const scraper = new ScraperService(url);

  scraper.onAuthFailure = async () => {
    console.log("Token expired/invalid (401). Re-authenticating...");
    const password = decryptStoredPassword(encryptedPwd, iv);
    const token = await getFreshAccessToken(userId, url, username, password);
    scraper.setAccessToken(token);
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

  // Token missing/expired: obtain a fresh one, deduped across concurrent callers.
  const password = decryptStoredPassword(encryptedPwd, iv);
  const token = await getFreshAccessToken(userId, url, username, password);
  scraper.setAccessToken(token);

  return scraper;
}
