import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockCookieGet, mockPrisma } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    tag: {
      findMany: vi.fn(),
    },
    userFile: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

import { signSessionValue } from "@/lib/session";
import { PATCH } from "../[id]/route";

const baseUserFile = {
  id: 5,
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
};

describe("PATCH /api/files/[id] tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret";
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: signSessionValue(1) });
    mockPrisma.userFile.findUnique.mockResolvedValue(baseUserFile);
    mockPrisma.tag.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    mockPrisma.userFile.update.mockResolvedValue({
      ...baseUserFile,
      storedFile: null,
      plan: null,
      tags: [
        { id: 10, name: "AP1" },
        { id: 11, name: "Exam" },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeRequest(body: object, id = "5") {
    return new Request(`http://localhost/api/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("adds tag IDs owned by the current user", async () => {
    const res = await PATCH(makeRequest({ addTagIds: [10, 11] }), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 11] }, userId: 1 },
      select: { id: true },
    });
    expect(mockPrisma.userFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: {
          tags: {
            connect: [{ id: 10 }, { id: 11 }],
          },
        },
      }),
    );
    const body = await res.json();
    expect(body.tags).toEqual([
      { id: 10, name: "AP1" },
      { id: 11, name: "Exam" },
    ]);
  });

  it("removes tag IDs owned by the current user", async () => {
    mockPrisma.tag.findMany.mockResolvedValue([{ id: 10 }]);
    mockPrisma.userFile.update.mockResolvedValue({
      ...baseUserFile,
      storedFile: null,
      plan: null,
      tags: [],
    });

    const res = await PATCH(makeRequest({ removeTagIds: [10] }), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.userFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: {
          tags: {
            disconnect: [{ id: 10 }],
          },
        },
      }),
    );
    const body = await res.json();
    expect(body.tags).toEqual([]);
  });

  it("returns 400 when addTagIds is not an array of numbers", async () => {
    const res = await PATCH(makeRequest({ addTagIds: ["10"] }), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(res.status).toBe(400);
    expect(mockPrisma.userFile.update).not.toHaveBeenCalled();
  });

  it("returns 400 when removeTagIds is not an array of numbers", async () => {
    const res = await PATCH(makeRequest({ removeTagIds: ["10"] }), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(res.status).toBe(400);
    expect(mockPrisma.userFile.update).not.toHaveBeenCalled();
  });

  it("rejects tags owned by another user", async () => {
    mockPrisma.tag.findMany.mockResolvedValue([]);

    const res = await PATCH(makeRequest({ addTagIds: [10] }), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.userFile.update).not.toHaveBeenCalled();
  });
});
