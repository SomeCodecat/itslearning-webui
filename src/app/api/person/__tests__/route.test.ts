import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetScraperForSession, mockGetPerson, mockIsAuthSessionError } =
  vi.hoisted(() => ({
    mockGetScraperForSession: vi.fn(),
    mockGetPerson: vi.fn(),
    mockIsAuthSessionError: vi.fn(),
  }));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
  isAuthSessionError: mockIsAuthSessionError,
}));

import { GET } from "../route";

describe("GET /api/person", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetScraperForSession.mockResolvedValue({ getPerson: mockGetPerson });
    mockGetPerson.mockResolvedValue({
      PersonId: 410031,
      FullName: "Test Student",
      CanAccessCalendar: true,
    });
    mockIsAuthSessionError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the signed-in person", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockGetPerson).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({
      PersonId: 410031,
      FullName: "Test Student",
      CanAccessCalendar: true,
    });
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
    mockGetPerson.mockRejectedValue(new Error("upstream failed"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to fetch person" });
  });
});
