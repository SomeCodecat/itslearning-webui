import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetScraperForSession, mockGetMessageThreads, mockIsAuthSessionError } =
  vi.hoisted(() => ({
    mockGetScraperForSession: vi.fn(),
    mockGetMessageThreads: vi.fn(),
    mockIsAuthSessionError: vi.fn(),
  }));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
  isAuthSessionError: mockIsAuthSessionError,
}));

import { GET } from "../route";

describe("GET /api/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetScraperForSession.mockResolvedValue({
      getMessageThreads: mockGetMessageThreads,
    });
    mockGetMessageThreads.mockResolvedValue([
      { InstantMessageThreadId: 1, Name: "Class chat" },
    ]);
    mockIsAuthSessionError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns message threads from the session scraper", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockGetMessageThreads).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual([
      { InstantMessageThreadId: 1, Name: "Class chat" },
    ]);
  });

  it("returns 401 for auth session errors", async () => {
    const error = new Error("No active session");
    mockGetScraperForSession.mockRejectedValue(error);
    mockIsAuthSessionError.mockReturnValue(true);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockIsAuthSessionError).toHaveBeenCalledWith(error);
  });

  it("returns 500 for other failures", async () => {
    mockGetMessageThreads.mockRejectedValue(new Error("upstream failed"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to fetch messages" });
  });
});
