import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieGet,
  mockPrisma,
  mockGetScraperForSession,
  mockDownloadFile,
  mockAttachDownloadedFile,
  mockExistsSync,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    userFile: {
      findMany: vi.fn(),
    },
  },
  mockGetScraperForSession: vi.fn(),
  mockDownloadFile: vi.fn(),
  mockAttachDownloadedFile: vi.fn(),
  mockExistsSync: vi.fn(),
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

vi.mock("fs", () => ({
  default: {
    existsSync: mockExistsSync,
  },
  existsSync: mockExistsSync,
}));

vi.mock("@/lib/services/FileService", () => ({
  FileService: vi.fn().mockImplementation(function () {
    return {
      attachDownloadedFile: mockAttachDownloadedFile,
    };
  }),
}));

import { signSessionValue } from "@/lib/session";
import { POST } from "../prepare/route";

/** Read a streamed NDJSON body into an array of parsed objects. */
async function readNdjson(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function makeRequest(ids: number[]) {
  return new Request("http://localhost/api/files/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

describe("POST /api/files/prepare", () => {
  const stub = {
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
    process.env.SESSION_SECRET = "test-session-secret";
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: signSessionValue(1) });
    mockPrisma.userFile.findMany.mockResolvedValue([stub]);
    mockGetScraperForSession.mockResolvedValue({
      downloadFile: mockDownloadFile,
    });
    mockAttachDownloadedFile.mockResolvedValue({
      userFile: { ...stub, storedFileId: 123 },
      storedFile: { id: 123 },
    });
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads a stub file and streams progress + done", async () => {
    mockDownloadFile.mockResolvedValue({
      filename: "download.txt",
      buffer: Buffer.from("payload"),
      mimeType: "text/plain",
    });

    const response = await POST(makeRequest([7]));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain(
      "application/x-ndjson",
    );

    const events = await readNdjson(response);
    expect(events).toEqual([
      { type: "progress", done: 1, total: 1, name: "Synced Name", ok: true },
      { type: "done", prepared: 1, failed: 0, alreadyHad: 0 },
    ]);
    expect(mockDownloadFile).toHaveBeenCalledWith(stub.webUrl);
    expect(mockAttachDownloadedFile).toHaveBeenCalledWith(
      stub,
      expect.any(Buffer),
      expect.objectContaining({ mimeType: "text/plain" }),
    );
  });

  it("reports a failed file without aborting the whole batch", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockDownloadFile.mockRejectedValue(new Error("boom"));

    const response = await POST(makeRequest([7]));
    const events = await readNdjson(response);

    expect(events).toEqual([
      { type: "progress", done: 1, total: 1, name: "Synced Name", ok: false },
      { type: "done", prepared: 0, failed: 1, alreadyHad: 0 },
    ]);
  });

  it("skips files already present on disk", async () => {
    mockPrisma.userFile.findMany.mockResolvedValue([
      { ...stub, storedFileId: 5, storedFile: { localPath: "/blobs/abc" } },
    ]);
    mockExistsSync.mockReturnValue(true);

    const response = await POST(makeRequest([7]));
    const events = await readNdjson(response);

    expect(mockDownloadFile).not.toHaveBeenCalled();
    expect(events.at(-1)).toEqual({
      type: "done",
      prepared: 0,
      failed: 0,
      alreadyHad: 1,
    });
  });

  it("returns 401 when there is no active session", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const response = await POST(makeRequest([7]));

    expect(response.status).toBe(401);
    expect(mockPrisma.userFile.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when some ids are not owned by the user", async () => {
    mockPrisma.userFile.findMany.mockResolvedValue([]); // requested 1, found 0

    const response = await POST(makeRequest([7]));

    expect(response.status).toBe(403);
  });

  it("returns 401 when re-authentication is required", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetScraperForSession.mockRejectedValue(new Error("No active session"));

    const response = await POST(makeRequest([7]));

    expect(response.status).toBe(401);
  });
});
