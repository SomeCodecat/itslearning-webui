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
    mockPrisma.assignment.findFirst.mockResolvedValue({
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
    expect(mockPrisma.assignment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 7,
        course: {
          users: {
            some: { id: 42 },
          },
        },
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
