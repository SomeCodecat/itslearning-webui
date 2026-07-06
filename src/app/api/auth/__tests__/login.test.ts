import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieSet,
  mockPrisma,
  mockAuthenticate,
  mockGetAccessToken,
  mockEncrypt,
  mockEncryptToString,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieSet: vi.fn(),
  mockPrisma: {
    user: {
      upsert: vi.fn(),
    },
  },
  mockAuthenticate: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockEncrypt: vi.fn(),
  mockEncryptToString: vi.fn(),
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

import { POST } from "../login/route";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ set: mockCookieSet });
    mockAuthenticate.mockResolvedValue(undefined);
    mockGetAccessToken.mockReturnValue("access-token");
    mockEncryptToString.mockReturnValue({
      encrypted: "tag:ciphertext",
      iv: "iv",
    });
    mockPrisma.user.upsert.mockResolvedValue({ id: 42 });
  });

  it("stores the decryptable tag:ciphertext password format", async () => {
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
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          itslearningPwd: "tag:ciphertext",
          itslearningIv: "iv",
          itslearningAccessToken: "access-token",
        }),
        create: expect.objectContaining({
          itslearningPwd: "tag:ciphertext",
          itslearningIv: "iv",
          itslearningAccessToken: "access-token",
        }),
      }),
    );
    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth_session",
      "42",
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
