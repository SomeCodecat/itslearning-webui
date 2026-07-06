import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieGet,
  mockPrisma,
  mockGetScraperForSession,
  mockGetAssignmentDetails,
  mockIsAuthSessionError,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    assignment: {
      findFirst: vi.fn(),
    },
  },
  mockGetScraperForSession: vi.fn(),
  mockGetAssignmentDetails: vi.fn(),
  mockIsAuthSessionError: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
  isAuthSessionError: mockIsAuthSessionError,
}));

import { GET } from "../route";

describe("GET /api/tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: "42" });
    mockPrisma.assignment.findFirst.mockImplementation(async ({
      where,
    }: {
      where?: { id?: number; elementId?: number; userId?: number };
    }) => {
      if (where && where.id === 7) {
        return {
          id: 7,
          elementId: 12345,
          courseId: 9,
          title: "Essay",
          webUrl: "https://school.example/task",
          deadline: new Date("2026-07-10T09:00:00.000Z"),
          status: "Active",
          course: {
            id: 9,
            title: "English",
          },
        };
      }
      return null;
    });
    mockGetScraperForSession.mockResolvedValue({
      getAssignmentDetails: mockGetAssignmentDetails,
    });
    mockGetAssignmentDetails.mockResolvedValue({
      StatusScale: {
        Title: "Submission status",
        StatusItems: [{ Title: "Submitted", IsSubmitted: true }],
      },
      AssessmentScale: null,
    });
    mockIsAuthSessionError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches live details for an assignment owned by the session user", async () => {
    const response = await GET(new Request("http://localhost/api/tasks/7"), {
      params: Promise.resolve({ id: "7" }),
    });

    expect(response.status).toBe(200);
    // elementId match is tried FIRST
    expect(mockPrisma.assignment.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        elementId: 7,
        userId: 42,
      },
      include: { course: true },
    });
    expect(mockGetAssignmentDetails).toHaveBeenCalledWith(12345);
    expect(await response.json()).toEqual({
      id: 7,
      elementId: 12345,
      courseId: 9,
      title: "Essay",
      webUrl: "https://school.example/task",
      deadline: "2026-07-10T09:00:00.000Z",
      status: "Active",
      course: {
        id: 9,
        title: "English",
      },
      details: {
        StatusScale: {
          Title: "Submission status",
          StatusItems: [{ Title: "Submitted", IsSubmitted: true }],
        },
        AssessmentScale: null,
      },
    });
  });

  it("falls back to primary key id when no elementId row matches", async () => {
    // First call (elementId lookup) returns null; second call (id lookup) returns the row.
    mockPrisma.assignment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 7,
        elementId: 12345,
        courseId: 9,
        title: "Essay",
        webUrl: "https://school.example/task",
        deadline: new Date("2026-07-10T09:00:00.000Z"),
        status: "Active",
        course: { id: 9, title: "English" },
      });

    const response = await GET(new Request("http://localhost/api/tasks/7"), {
      params: Promise.resolve({ id: "7" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.assignment.findFirst).toHaveBeenCalledTimes(2);
    // Second call uses primary key id
    expect(mockPrisma.assignment.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        id: 7,
        userId: 42,
      },
      include: { course: true },
    });
  });

  it("collision: querying id=9 returns elementId=9 row (row A), not the id=9 row (row B)", async () => {
    // Row A: id=5, elementId=9
    // Row B: id=9, elementId=77
    // The frontend sends 9 (elementId of row A). Without fix, old code would
    // match row B first (id=9). With fix, row A is found via elementId match.
    const rowA = {
      id: 5,
      elementId: 9,
      courseId: 9,
      title: "Row A",
      webUrl: null,
      deadline: null,
      status: "Active",
      course: { id: 9, title: "English" },
    };

    // elementId lookup returns Row A immediately — id lookup must NOT be called.
    mockPrisma.assignment.findFirst.mockResolvedValueOnce(rowA);

    const response = await GET(new Request("http://localhost/api/tasks/9"), {
      params: Promise.resolve({ id: "9" }),
    });

    expect(response.status).toBe(200);
    // Only one DB call: the elementId query
    expect(mockPrisma.assignment.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.assignment.findFirst).toHaveBeenCalledWith({
      where: {
        elementId: 9,
        userId: 42,
      },
      include: { course: true },
    });
    const body = await response.json();
    expect(body.id).toBe(5); // row A, not row B
    expect(body.elementId).toBe(9);
  });

  it("returns 401 without an active local session", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const response = await GET(new Request("http://localhost/api/tasks/7"), {
      params: Promise.resolve({ id: "7" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockPrisma.assignment.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the assignment is missing or has no element id", async () => {
    mockPrisma.assignment.findFirst.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/tasks/7"), {
      params: Promise.resolve({ id: "7" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Task not found" });
    expect(mockGetScraperForSession).not.toHaveBeenCalled();
  });

  it("returns 401 when scraper session setup fails", async () => {
    const error = new Error("No active session");
    mockGetScraperForSession.mockRejectedValue(error);
    mockIsAuthSessionError.mockReturnValue(true);

    const response = await GET(new Request("http://localhost/api/tasks/7"), {
      params: Promise.resolve({ id: "7" }),
    });

    expect(response.status).toBe(401);
    expect(mockIsAuthSessionError).toHaveBeenCalledWith(error);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
