import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockCookieGet, mockCookieSet, mockCookieDelete } =
  vi.hoisted(() => ({
    mockCookies: vi.fn(),
    mockCookieGet: vi.fn(),
    mockCookieSet: vi.fn(),
    mockCookieDelete: vi.fn(),
  }));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

import {
  clearSessionCookie,
  getSessionUserId,
  setSessionCookie,
  signSessionValue,
} from "../session";

describe("session cookies", () => {
  const originalSessionSecret = process.env.SESSION_SECRET;
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret";
    delete process.env.ENCRYPTION_KEY;
    mockCookies.mockResolvedValue({
      get: mockCookieGet,
      set: mockCookieSet,
      delete: mockCookieDelete,
    });
    mockCookieGet.mockReturnValue(undefined);
  });

  afterEach(() => {
    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }

    if (originalEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it("round-trips a signed session cookie value", async () => {
    await setSessionCookie(5);
    const signedValue = mockCookieSet.mock.calls[0][1];
    mockCookieGet.mockReturnValue({ value: signedValue });

    await expect(getSessionUserId()).resolves.toBe(5);
  });

  it("rejects a tampered signed value", async () => {
    const signedValue = signSessionValue(5).replace(/^5\./, "6.");
    mockCookieGet.mockReturnValue({ value: signedValue });

    await expect(getSessionUserId()).resolves.toBeNull();
  });

  it("rejects a value signed with a different secret", async () => {
    process.env.SESSION_SECRET = "other-secret";
    const signedValue = signSessionValue(5);
    process.env.SESSION_SECRET = "test-session-secret";
    mockCookieGet.mockReturnValue({ value: signedValue });

    await expect(getSessionUserId()).resolves.toBeNull();
  });

  it("rejects an unsigned raw user id", async () => {
    mockCookieGet.mockReturnValue({ value: "5" });

    await expect(getSessionUserId()).resolves.toBeNull();
  });

  it("returns null when the cookie is missing", async () => {
    mockCookieGet.mockReturnValue(undefined);

    await expect(getSessionUserId()).resolves.toBeNull();
  });

  it("clears the session cookie", async () => {
    await clearSessionCookie();

    expect(mockCookieDelete).toHaveBeenCalledWith("auth_session");
  });
});
