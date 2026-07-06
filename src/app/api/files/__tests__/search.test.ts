import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockCookieGet, mockPrisma } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    userFile: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("mime-types", () => ({
  default: { lookup: () => false },
}));

import { GET } from "../search/route";

function makeUserFile(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: 1,
    storedFileId: null,
    storedFile: null,
    planId: null,
    elementId: 42,
    customName: "Lecture Notes.pdf",
    webUrl: "https://example.com/file",
    folderPath: null,
    uploader: "System",
    uploadedAt: null,
    isExamRelevant: false,
    isAP1: false,
    isAP2: false,
    isArchived: false,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    plan: null,
    tags: [],
    ...overrides,
  };
}

describe("GET /api/files/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: "1" });
    mockPrisma.userFile.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeRequest(q: string) {
    return new Request(`http://localhost/api/files/search?q=${q}`);
  }

  it("returns 401 without a session", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await GET(makeRequest("algebra"));

    expect(res.status).toBe(401);
    expect(mockPrisma.userFile.findMany).not.toHaveBeenCalled();
  });

  it("returns 400 for a short query", async () => {
    const res = await GET(makeRequest("a"));

    expect(res.status).toBe(400);
    expect(mockPrisma.userFile.findMany).not.toHaveBeenCalled();
  });

  it("returns name and content matches with the correct contentMatch flag", async () => {
    mockPrisma.userFile.findMany.mockResolvedValue([
      makeUserFile({
        id: 1,
        customName: "Algebra worksheet.pdf",
        storedFile: { size: 100, mimeType: "application/pdf", textContent: "" },
      }),
      makeUserFile({
        id: 2,
        customName: "Lecture notes.pdf",
        storedFile: {
          size: 200,
          mimeType: "application/pdf",
          textContent: "This file mentions algebra in the body.",
        },
      }),
    ]);

    const res = await GET(makeRequest("algebra"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      expect.objectContaining({
        id: 1,
        customName: "Algebra worksheet.pdf",
        contentMatch: false,
      }),
      expect.objectContaining({
        id: 2,
        customName: "Lecture notes.pdf",
        contentMatch: true,
      }),
    ]);
  });

  it("scopes search results to the current user", async () => {
    mockCookieGet.mockReturnValue({ value: "42" });

    const res = await GET(makeRequest("notes"));

    expect(res.status).toBe(200);
    expect(mockPrisma.userFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 42,
        }),
      }),
    );
  });
});
