import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetScraperForSession,
  mockGetUnreadCounts,
  mockIsAuthSessionError,
} = vi.hoisted(() => ({
  mockGetScraperForSession: vi.fn(),
  mockGetUnreadCounts: vi.fn(),
  mockIsAuthSessionError: vi.fn(),
}));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
  isAuthSessionError: mockIsAuthSessionError,
}));

import { GET } from "../route";

describe("GET /api/notifications/counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetScraperForSession.mockResolvedValue({
      getUnreadCounts: mockGetUnreadCounts,
    });
    mockGetUnreadCounts.mockResolvedValue({
      unreadNotifications: 2,
      unseenNotifications: 5,
      unreadMessages: 1,
    });
    mockIsAuthSessionError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns unread counts from the session scraper", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockGetScraperForSession).toHaveBeenCalledOnce();
    expect(mockGetUnreadCounts).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({
      unreadNotifications: 2,
      unseenNotifications: 5,
      unreadMessages: 1,
    });
  });

  it("returns 401 for auth session errors", async () => {
    const error = new Error("No active session");
    mockGetScraperForSession.mockRejectedValue(error);
    mockIsAuthSessionError.mockReturnValue(true);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockIsAuthSessionError).toHaveBeenCalledWith(error);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 for other failures", async () => {
    mockGetUnreadCounts.mockRejectedValue(new Error("upstream failed"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch notification counts",
    });
  });
});
