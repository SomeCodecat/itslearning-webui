import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockCookieGet, mockPrisma } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    tag: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { DELETE } from "../[id]/route";

const baseTag = { id: 7, userId: 1, name: "lecture" };

describe("DELETE /api/tags/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: "1" });
    mockPrisma.tag.findUnique.mockResolvedValue(baseTag);
    mockPrisma.tag.delete.mockResolvedValue(baseTag);
  });

  afterEach(() => vi.restoreAllMocks());

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("returns 401 when no session", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await DELETE(new Request("http://localhost/api/tags/7"), makeParams("7"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-numeric id", async () => {
    const res = await DELETE(new Request("http://localhost/api/tags/abc"), makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when tag not found", async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost/api/tags/7"), makeParams("7"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when tag belongs to a different user", async () => {
    mockPrisma.tag.findUnique.mockResolvedValue({ ...baseTag, userId: 99 });
    const res = await DELETE(new Request("http://localhost/api/tags/7"), makeParams("7"));
    expect(res.status).toBe(404);
  });

  it("deletes tag and returns 204", async () => {
    const res = await DELETE(new Request("http://localhost/api/tags/7"), makeParams("7"));
    expect(res.status).toBe(204);
    expect(mockPrisma.tag.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });
});
