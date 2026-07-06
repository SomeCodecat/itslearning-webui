import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetScraperForSession,
  mockIsAuthSessionError,
  mockScraper,
} = vi.hoisted(() => ({
  mockGetScraperForSession: vi.fn(),
  mockIsAuthSessionError: vi.fn(),
  mockScraper: {
    getCalendarEvents: vi.fn(),
  },
}));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
  isAuthSessionError: mockIsAuthSessionError,
}));

import { GET } from "../route";

describe("GET /api/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScraperForSession.mockResolvedValue(mockScraper);
    mockIsAuthSessionError.mockReturnValue(false);
    mockScraper.getCalendarEvents.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps raw itslearning calendar events to the frontend event shape", async () => {
    mockScraper.getCalendarEvents.mockResolvedValue([
      {
        EventId: 123,
        EventTitle: "Math exam",
        Description: "Bring calculator",
        FromDate: "2026-07-07T08:00:00Z",
        ToDate: "2026-07-07T09:30:00Z",
        EventType: "Test",
        LocationTitle: "Room 12",
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/calendar?from=2026-07-01&to=2026-07-31"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        EventId: 123,
        Title: "Math exam",
        Description: "Bring calculator",
        From: "2026-07-07T08:00:00Z",
        To: "2026-07-07T09:30:00Z",
        EventType: "Test",
        LocationTitle: "Room 12",
      },
    ]);
  });

  it("returns 400 for an invalid from query parameter", async () => {
    const response = await GET(
      new Request("http://localhost/api/calendar?from=not-a-date"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid date: not-a-date" });
    expect(mockGetScraperForSession).not.toHaveBeenCalled();
  });
});
