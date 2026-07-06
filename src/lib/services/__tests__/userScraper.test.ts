import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockScraper = {
  instanceUrl: string;
  onAuthFailure: undefined | (() => Promise<void>);
  authenticate: ReturnType<typeof vi.fn>;
  getAccessToken: ReturnType<typeof vi.fn>;
  setAccessToken: ReturnType<typeof vi.fn>;
};

const {
  mockCookies,
  mockCookieGet,
  mockPrisma,
  mockDecrypt,
  mockScraperInstances,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockDecrypt: vi.fn(),
  mockScraperInstances: [] as MockScraper[],
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/services/CryptoService", () => ({
  CryptoService: {
    decrypt: mockDecrypt,
  },
}));

vi.mock("@/lib/services/ScraperService", () => ({
  ScraperService: vi.fn().mockImplementation(function (instanceUrl: string) {
    const scraper = {
      instanceUrl,
      onAuthFailure: undefined as undefined | (() => Promise<void>),
      authenticate: vi.fn().mockResolvedValue(undefined),
      getAccessToken: vi.fn(() => "fresh-token"),
      setAccessToken: vi.fn(),
    };
    mockScraperInstances.push(scraper);
    return scraper;
  }),
}));

import { getScraperForSession } from "../../userScraper";

describe("getScraperForSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScraperInstances.length = 0;
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: "1" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses a valid cached access token without decrypting the stored password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      itslearningUser: "user",
      itslearningPwd: "legacy-broken-ciphertext",
      itslearningIv: "iv",
      itslearningUrl: "https://school.example",
      itslearningAccessToken: "cached-token",
      itslearningTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    const scraper = await getScraperForSession();

    expect(mockDecrypt).not.toHaveBeenCalled();
    expect(mockScraperInstances[0].setAccessToken).toHaveBeenCalledWith(
      "cached-token",
    );
    expect(scraper).toBe(mockScraperInstances[0]);
  });

  it("turns decryption failure during re-authentication into an auth failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    mockPrisma.user.findUnique.mockResolvedValue({
      itslearningUser: "user",
      itslearningPwd: "legacy-broken-ciphertext",
      itslearningIv: "iv",
      itslearningUrl: "https://school.example",
      itslearningAccessToken: "expired-token",
      itslearningTokenExpiresAt: new Date(Date.now() - 60_000),
    });
    mockDecrypt.mockImplementation(() => {
      throw new Error("Invalid encrypted format");
    });

    await expect(getScraperForSession()).rejects.toThrow("No active session");
    expect(mockScraperInstances[0].authenticate).not.toHaveBeenCalled();
  });
});
