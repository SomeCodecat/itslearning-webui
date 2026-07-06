import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieGet,
  mockPrisma,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
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

// FileListMapper uses mime-types — stub it to avoid needing the real module
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

describe("PATCH /api/files/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret";
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: signSessionValue(1) });
    mockPrisma.userFile.findUnique.mockResolvedValue(baseUserFile);
    mockPrisma.userFile.update.mockResolvedValue({
      ...baseUserFile,
      isExamRelevant: true,
      storedFile: null,
      plan: null,
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

  it("returns 401 when no session cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await PATCH(makeRequest({ isExamRelevant: true }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid file ID", async () => {
    const res = await PATCH(makeRequest({ isExamRelevant: true }), {
      params: Promise.resolve({ id: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body has no valid flags", async () => {
    const res = await PATCH(makeRequest({ randomField: true }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when a flag value is not boolean", async () => {
    const res = await PATCH(makeRequest({ isAP1: "yes" }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when file belongs to a different user", async () => {
    mockPrisma.userFile.findUnique.mockResolvedValue({
      ...baseUserFile,
      userId: 99,
    });
    const res = await PATCH(makeRequest({ isExamRelevant: true }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when file does not exist", async () => {
    mockPrisma.userFile.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ isExamRelevant: true }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(404);
  });

  it("updates a single flag and returns mapped file", async () => {
    const res = await PATCH(makeRequest({ isExamRelevant: true }), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.userFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: { isExamRelevant: true },
      }),
    );
    const body = await res.json();
    expect(body.isExamRelevant).toBe(true);
    expect(body.id).toBe(5);
  });

  it("allows updating multiple flags at once", async () => {
    mockPrisma.userFile.update.mockResolvedValue({
      ...baseUserFile,
      isAP1: true,
      isAP2: true,
      storedFile: null,
      plan: null,
    });

    const res = await PATCH(makeRequest({ isAP1: true, isAP2: true }), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.userFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isAP1: true, isAP2: true },
      }),
    );
  });
});
