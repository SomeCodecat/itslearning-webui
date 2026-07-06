import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockCookieGet, mockPrisma } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    tag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
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

import { GET, POST } from "../route";

describe("GET /api/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: "1" });
    mockPrisma.tag.findMany.mockResolvedValue([
      { id: 1, name: "important" },
      { id: 2, name: "revision" },
    ]);
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when no session cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns list of user tags", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("important");
  });
});

describe("POST /api/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: "1" });
    mockPrisma.tag.findUnique.mockResolvedValue(null);
    mockPrisma.tag.create.mockResolvedValue({ id: 3, name: "new-tag" });
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when no session", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty name", async () => {
    const res = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 with existing tag if name already used", async () => {
    mockPrisma.tag.findUnique.mockResolvedValue({ id: 1, name: "important" });
    const res = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "important" }),
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.id).toBe(1);
  });

  it("creates and returns new tag with 201", async () => {
    const res = await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "new-tag" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("new-tag");
  });

  it("trims whitespace from tag name", async () => {
    await POST(
      new Request("http://localhost/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  padded  " }),
      }),
    );
    expect(mockPrisma.tag.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_name: { userId: 1, name: "padded" } },
      }),
    );
  });
});
