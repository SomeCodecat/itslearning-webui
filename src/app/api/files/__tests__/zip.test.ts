import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "stream";

const { mockCookies, mockCookieGet, mockPrisma, mockExistsSync } = vi.hoisted(
  () => ({
    mockCookies: vi.fn(),
    mockCookieGet: vi.fn(),
    mockPrisma: {
      userFile: {
        findMany: vi.fn(),
      },
    },
    mockExistsSync: vi.fn(),
  }),
);

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("fs", () => ({
  default: {
    existsSync: mockExistsSync,
  },
}));

vi.mock("archiver", () => {
  return {
    default: vi.fn().mockImplementation(() => {
      interface MockArchive extends Readable {
        file: unknown;
        finalize: unknown;
      }
      const mockArchive = new Readable({ read() {} }) as MockArchive;
      mockArchive.file = vi.fn().mockReturnValue(mockArchive);
      mockArchive.finalize = vi.fn().mockImplementation(() => {
        mockArchive.push("zip-binary-data");
        mockArchive.push(null);
      });
      return mockArchive;
    }),
  };
});

import { signSessionValue } from "@/lib/session";
import { POST } from "../zip/route";

describe("POST /api/files/zip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret";
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: signSessionValue(1) });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without an active session", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/files/zip", {
        method: "POST",
        body: JSON.stringify({ ids: [1, 2] }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid body", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/zip", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid body. Expected JSON { ids: number[] }",
    });
  });

  it("returns 413 if zipping more than 500 files", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => i + 1);

    const response = await POST(
      new Request("http://localhost/api/files/zip", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "Refused: Cannot zip more than 500 files at once",
    });
  });

  it("returns 403 if user does not own some of the requested files", async () => {
    // Requested 2 files, database only returns 1 (meaning the other is missing/unowned)
    mockPrisma.userFile.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 1,
        storedFile: { size: BigInt(100), localPath: "/path/1" },
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/files/zip", {
        method: "POST",
        body: JSON.stringify({ ids: [1, 2] }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden: Some requested files were not found or not owned by you",
    });
  });

  it("returns 413 if total file size exceeds 2GB limit", async () => {
    mockPrisma.userFile.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 1,
        storedFile: { size: BigInt(3000000000), localPath: "/path/1" },
      },
    ]);

    const response = await POST(
      new Request("http://localhost/api/files/zip", {
        method: "POST",
        body: JSON.stringify({ ids: [1] }),
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "Refused: Total file size exceeds 2GB limit",
    });
  });

  it("returns 200 and streams zip for valid requests, zipping exists files", async () => {
    mockPrisma.userFile.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 1,
        customName: "Document 1.pdf",
        folderPath: "Lectures/Math",
        storedFile: { size: BigInt(1024), localPath: "/path/1" },
      },
      {
        id: 2,
        userId: 1,
        customName: "Missing.txt",
        storedFile: { size: BigInt(200), localPath: "/path/missing" },
      },
    ]);

    mockExistsSync.mockImplementation((path: string) => path === "/path/1");

    const response = await POST(
      new Request("http://localhost/api/files/zip", {
        method: "POST",
        body: JSON.stringify({ ids: [1, 2] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("X-Skipped-Files")).toBe("1"); // Missing.txt is skipped

    const bodyText = await response.text();
    expect(bodyText).toBe("zip-binary-data");
  });
});
