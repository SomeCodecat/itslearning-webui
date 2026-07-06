import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieGet,
  mockPrisma,
  mockAuthenticate,
  mockGetAccessToken,
  mockEncryptToString,
  mockScraperService,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockAuthenticate: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockEncryptToString: vi.fn(),
  mockScraperService: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/services/ScraperService", () => ({
  ScraperService: mockScraperService.mockImplementation(function () {
    return {
      authenticate: mockAuthenticate,
      getAccessToken: mockGetAccessToken,
    };
  }),
}));

vi.mock("@/lib/services/CryptoService", () => ({
  CryptoService: {
    encryptToString: mockEncryptToString,
  },
}));

import { signSessionValue } from "@/lib/session";
import { POST } from "../route";

describe("POST /api/auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret";
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: signSessionValue(42) });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 42 });
    mockPrisma.user.update.mockResolvedValue({
      itslearningUrl: "https://school.example",
      itslearningUser: "student",
      lastSyncedAt: null,
    });
    mockAuthenticate.mockResolvedValue(undefined);
    mockGetAccessToken.mockReturnValue("access-token");
    mockEncryptToString.mockReturnValue({
      encrypted: "tag:ciphertext",
      iv: "iv",
    });
  });

  it("validates and stores ITSLearning credentials for the current user", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "student",
          password: "secret",
          organizationUrl: "https://school.example",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockScraperService).toHaveBeenCalledWith("https://school.example");
    expect(mockAuthenticate).toHaveBeenCalledWith("student", "secret");
    expect(mockEncryptToString).toHaveBeenCalledWith("secret");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: expect.objectContaining({
        itslearningUser: "student",
        itslearningPwd: "tag:ciphertext",
        itslearningIv: "iv",
        itslearningAccessToken: "access-token",
        itslearningUrl: "https://school.example",
      }),
      select: {
        itslearningUrl: true,
        itslearningUser: true,
        lastSyncedAt: true,
      },
    });
    expect(await response.json()).toEqual({
      success: true,
      user: {
        itslearningUrl: "https://school.example",
        itslearningUser: "student",
        lastSyncedAt: null,
      },
    });
  });

  it("requires an active session", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "student",
          password: "secret",
          organizationUrl: "https://school.example",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects invalid ITSLearning credentials", async () => {
    mockAuthenticate.mockRejectedValue(new Error("bad credentials"));

    const response = await POST(
      new Request("http://localhost/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "student",
          password: "wrong",
          organizationUrl: "https://school.example",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Invalid ITSLearning credentials",
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
