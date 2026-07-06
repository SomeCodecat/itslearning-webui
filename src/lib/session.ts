import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "auth_session";
const DEV_SESSION_SECRET = "itslearning-webui-dev-session-secret";

let warnedAboutDevSecret = false;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET or ENCRYPTION_KEY must be set");
  }

  if (!warnedAboutDevSecret) {
    console.warn(
      "SESSION_SECRET and ENCRYPTION_KEY are unset; using a development-only session secret.",
    );
    warnedAboutDevSecret = true;
  }

  return DEV_SESSION_SECRET;
}

function isPositiveIntegerText(value: string): boolean {
  if (!/^[1-9]\d*$/.test(value)) {
    return false;
  }

  return Number.isSafeInteger(Number(value));
}

function signUserIdText(userIdText: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(userIdText)
    .digest("base64url");
}

export function signSessionValue(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("Session user id must be a positive integer");
  }

  const userIdText = String(userId);
  return `${userIdText}.${signUserIdText(userIdText)}`;
}

export async function setSessionCookie(userId: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signSessionValue(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function getSessionUserId(): Promise<number | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const cookieValue = sessionCookie.value;
    const separatorIndex = cookieValue.lastIndexOf(".");

    if (separatorIndex <= 0 || separatorIndex === cookieValue.length - 1) {
      return null;
    }

    const userIdText = cookieValue.slice(0, separatorIndex);
    const signature = cookieValue.slice(separatorIndex + 1);

    if (!isPositiveIntegerText(userIdText)) {
      return null;
    }

    const expectedSignature = signUserIdText(userIdText);
    const expectedBuffer = Buffer.from(expectedSignature);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length) {
      return null;
    }

    if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
      return null;
    }

    return Number(userIdText);
  } catch {
    return null;
  }
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
