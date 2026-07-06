import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieGet,
  mockCookieSet,
  mockPrisma,
  mockAuthenticate,
  mockGetAccessToken,
  mockEncrypt,
  mockEncryptToString,
  mockVerifyPassword,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockCookieSet: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
  mockAuthenticate: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockEncrypt: vi.fn(),
  mockEncryptToString: vi.fn(),
  mockVerifyPassword: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/services/ScraperService", () => ({
  ScraperService: vi.fn().mockImplementation(function () {
    return {
      authenticate: mockAuthenticate,
      getAccessToken: mockGetAccessToken,
    };
  }),
}));

vi.mock("@/lib/services/CryptoService", () => ({
  CryptoService: {
    encrypt: mockEncrypt,
    encryptToString: mockEncryptToString,
  },
}));

vi.mock("@/lib/passwordHash", () => ({
  verifyPassword: mockVerifyPassword,
}));

import { POST } from "../login/route";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ get: mockCookieGet, set: mockCookieSet });
    mockCookieGet.mockReturnValue(undefined); // no active session by default
    mockAuthenticate.mockResolvedValue(undefined);
    mockGetAccessToken.mockReturnValue("access-token");
    mockEncryptToString.mockReturnValue({
      encrypted: "tag:ciphertext",
      iv: "iv",
    });
    // No local user by default
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.update.mockResolvedValue({ id: 42 });
    mockPrisma.user.create.mockResolvedValue({ id: 99 });
  });

  // ─── Local login ────────────────────────────────────────────────────────────

  it("logs in locally when email matches a user with a passwordHash", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 7,
      passwordHash: "scrypt:abc:def",
    });
    mockVerifyPassword.mockResolvedValue(true);

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@example.com",
          password: "localpass",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockVerifyPassword).toHaveBeenCalledWith(
      "localpass",
      "scrypt:abc:def",
    );
    // No ITSLearning call
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth_session",
      "7",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("returns 401 for wrong local password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 7,
      passwordHash: "scrypt:abc:def",
    });
    mockVerifyPassword.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@example.com",
          password: "wrongpass",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  // ─── Step 1: active session → link ──────────────────────────────────────────

  it("links ITSLearning credentials to the session user (step 1)", async () => {
    // No local user by email
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // email lookup → no local user
      .mockResolvedValueOnce({ id: 42 }) // session user exists
      .mockResolvedValueOnce(null); // no existing owner of itslearningUser
    mockCookieGet.mockReturnValue({ value: "42" });

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "student",
          password: "secret",
          organizationUrl: "https://school.example",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42 } }),
    );
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("returns 409 when the itslearningUser is already owned by a different user (step 1)", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // email lookup
      .mockResolvedValueOnce({ id: 42 }) // session user
      .mockResolvedValueOnce({ id: 99 }); // existing owner — different user
    mockCookieGet.mockReturnValue({ value: "42" });

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "student",
          password: "secret",
          organizationUrl: "https://school.example",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  // ─── Step 2: existing itslearningUser row ───────────────────────────────────

  it("updates the existing itslearningUser row when no session cookie (step 2)", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // email lookup → no local user
      .mockResolvedValueOnce({ id: 55 }); // byItslearning lookup

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "student",
          password: "secret",
          organizationUrl: "https://school.example",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 55 } }),
    );
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  // ─── Step 3: orphaned setup admin ──────────────────────────────────────────

  it("links to the orphaned setup admin when exactly one exists (step 3)", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // email lookup
      .mockResolvedValueOnce(null); // byItslearning → no existing
    mockPrisma.user.findMany.mockResolvedValue([{ id: 1 }]); // one orphaned admin

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "student",
          password: "secret",
          organizationUrl: "https://school.example",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  // ─── Step 4: create new user ────────────────────────────────────────────────

  it("stores the decryptable tag:ciphertext password format (step 4 — create)", async () => {
    // No local user, no session, no existing itslearningUser row, no orphaned admin
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // email lookup
      .mockResolvedValueOnce(null); // byItslearning

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "student",
          password: "secret",
          organizationUrl: "https://school.example",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockEncryptToString).toHaveBeenCalledWith("secret");
    expect(mockEncrypt).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itslearningPwd: "tag:ciphertext",
        itslearningIv: "iv",
        itslearningAccessToken: "access-token",
      }),
      select: { id: true },
    });
    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth_session",
      "99",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  it("returns 400 when identifier is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "secret" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 when ITSLearning authentication fails", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockAuthenticate.mockRejectedValue(new Error("bad credentials"));

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "student",
          password: "wrong",
          organizationUrl: "https://school.example",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
