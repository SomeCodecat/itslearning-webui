import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetScraperForSession,
  mockGetLightBulletins,
} = vi.hoisted(() => ({
  mockGetScraperForSession: vi.fn(),
  mockGetLightBulletins: vi.fn(),
}));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
  isAuthSessionError: (error: unknown) =>
    error instanceof Error && error.message === "No active session",
}));

import { GET } from "../route";

describe("GET /api/courses/[id]/bulletins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScraperForSession.mockResolvedValue({
      getLightBulletins: mockGetLightBulletins,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeRequest(id: string) {
    return {
      request: new Request(`http://localhost/api/courses/${id}/bulletins`),
      params: Promise.resolve({ id }),
    };
  }

  it("returns 400 for non-numeric course ID", async () => {
    const { request, params } = makeRequest("not-a-number");
    const res = await GET(request, { params });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid course ID" });
  });

  it("returns 401 when no active session", async () => {
    mockGetScraperForSession.mockRejectedValue(new Error("No active session"));
    const { request, params } = makeRequest("42");
    const res = await GET(request, { params });
    expect(res.status).toBe(401);
  });

  it("returns bulletins array on success", async () => {
    const fakeBulletins = [
      {
        BulletinId: 1,
        Title: "Welcome",
        Text: "Hello students",
        PublishedDate: "2026-01-01T00:00:00Z",
        AuthorFullName: "Jane Doe",
      },
    ];
    mockGetLightBulletins.mockResolvedValue(fakeBulletins);

    const { request, params } = makeRequest("42");
    const res = await GET(request, { params });

    expect(res.status).toBe(200);
    expect(mockGetLightBulletins).toHaveBeenCalledWith(42);
    const body = await res.json();
    expect(body).toEqual(fakeBulletins);
  });

  it("returns empty array when scraper returns nothing", async () => {
    mockGetLightBulletins.mockResolvedValue([]);
    const { request, params } = makeRequest("99");
    const res = await GET(request, { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 500 on unexpected scraper error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetLightBulletins.mockRejectedValue(new Error("Network timeout"));
    const { request, params } = makeRequest("42");
    const res = await GET(request, { params });
    expect(res.status).toBe(500);
  });
});
