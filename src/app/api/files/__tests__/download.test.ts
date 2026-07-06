import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieGet,
  mockPrisma,
  mockGetScraperForSession,
  mockDownloadFile,
  mockAttachDownloadedFile,
  mockReadFile,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    userFile: {
      findUnique: vi.fn(),
    },
  },
  mockGetScraperForSession: vi.fn(),
  mockDownloadFile: vi.fn(),
  mockAttachDownloadedFile: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
  isAuthSessionError: (error: unknown) =>
    error instanceof Error && error.message === "No active session",
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: mockReadFile,
  },
}));

vi.mock("@/lib/services/FileService", () => ({
  FileService: vi.fn().mockImplementation(function () {
    return {
      attachDownloadedFile: mockAttachDownloadedFile,
    };
  }),
}));

import { GET } from "../download/route";

describe("GET /api/files/download", () => {
  const userFile = {
    id: 7,
    userId: 1,
    storedFileId: null,
    storedFile: null,
    planId: 3,
    elementId: 99,
    customName: "Synced Name",
    webUrl: "https://school.example/file",
    folderPath: "Week 1",
    uploader: "System",
    uploadedAt: new Date("2026-01-02T03:04:05.000Z"),
    isExamRelevant: true,
    isAP1: false,
    isAP2: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: "1" });
    mockPrisma.userFile.findUnique.mockResolvedValue(userFile);
    mockGetScraperForSession.mockResolvedValue({
      downloadFile: mockDownloadFile,
    });
    mockAttachDownloadedFile.mockResolvedValue({
      userFile: { ...userFile, storedFileId: 123 },
      storedFile: { id: 123 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates lazy persistence to FileService and streams the download", async () => {
    const buffer = Buffer.from("payload");
    mockDownloadFile.mockResolvedValue({
      filename: "download.txt",
      buffer,
      mimeType: "text/plain",
    });

    const response = await GET(
      new Request("http://localhost/api/files/download?id=7"),
    );

    expect(response.status).toBe(200);
    expect(mockDownloadFile).toHaveBeenCalledWith(userFile.webUrl);
    expect(mockAttachDownloadedFile).toHaveBeenCalledWith(
      userFile,
      buffer,
      expect.objectContaining({
        customName: userFile.customName,
        webUrl: userFile.webUrl,
        folderPath: userFile.folderPath,
        mimeType: "text/plain",
      }),
    );
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(await response.text()).toBe("payload");
  });

  it("returns 401 when re-authentication requires login", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetScraperForSession.mockRejectedValue(
      new Error("No active session"),
    );

    const response = await GET(
      new Request("http://localhost/api/files/download?id=7"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
