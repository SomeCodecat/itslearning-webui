import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetScraperForSession,
  mockGetNotifications,
  mockIsAuthSessionError,
} = vi.hoisted(() => ({
  mockGetScraperForSession: vi.fn(),
  mockGetNotifications: vi.fn(),
  mockIsAuthSessionError: vi.fn(),
}));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
  isAuthSessionError: mockIsAuthSessionError,
}));

import { GET } from "../route";

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetScraperForSession.mockResolvedValue({
      getNotifications: mockGetNotifications,
    });
    mockGetNotifications.mockResolvedValue([
      {
        NotificationId: 1,
        Text: "New feedback",
        PublishedDate: "2026-07-06T10:00:00Z",
        IsRead: false,
      },
    ]);
    mockIsAuthSessionError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns notifications from the session scraper", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockGetScraperForSession).toHaveBeenCalledOnce();
    expect(mockGetNotifications).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual([
      {
        NotificationId: 1,
        Text: "New feedback",
        PublishedDate: "2026-07-06T10:00:00Z",
        IsRead: false,
      },
    ]);
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
    mockGetNotifications.mockRejectedValue(new Error("upstream failed"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch notifications",
    });
  });
});
