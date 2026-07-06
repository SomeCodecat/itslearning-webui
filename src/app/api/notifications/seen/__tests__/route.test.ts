import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetScraperForSession,
  mockMarkAllNotificationsSeen,
  mockIsAuthSessionError,
} = vi.hoisted(() => ({
  mockGetScraperForSession: vi.fn(),
  mockMarkAllNotificationsSeen: vi.fn(),
  mockIsAuthSessionError: vi.fn(),
}));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
  isAuthSessionError: mockIsAuthSessionError,
}));

import { POST } from "../route";

describe("POST /api/notifications/seen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetScraperForSession.mockResolvedValue({
      markAllNotificationsSeen: mockMarkAllNotificationsSeen,
    });
    mockMarkAllNotificationsSeen.mockResolvedValue(undefined);
    mockIsAuthSessionError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks all notifications as seen", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(mockMarkAllNotificationsSeen).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 401 for auth session errors", async () => {
    const error = new Error("No active session");
    mockGetScraperForSession.mockRejectedValue(error);
    mockIsAuthSessionError.mockReturnValue(true);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(mockIsAuthSessionError).toHaveBeenCalledWith(error);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 for other failures", async () => {
    mockMarkAllNotificationsSeen.mockRejectedValue(new Error("upstream failed"));

    const response = await POST();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to mark notifications as seen",
    });
  });
});
