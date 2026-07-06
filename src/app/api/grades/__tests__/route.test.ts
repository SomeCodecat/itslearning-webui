import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockCookieGet, mockPrisma, mockIsAuthSessionError } =
  vi.hoisted(() => ({
    mockCookies: vi.fn(),
    mockCookieGet: vi.fn(),
    mockPrisma: {
      grade: {
        findMany: vi.fn(),
      },
    },
    mockIsAuthSessionError: vi.fn(),
  }));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/userScraper", () => ({
  isAuthSessionError: mockIsAuthSessionError,
}));

import { GET } from "../route";

describe("GET /api/grades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: "42" });
    mockIsAuthSessionError.mockReturnValue(false);
    mockPrisma.grade.findMany.mockResolvedValue([
      {
        id: 7,
        assignmentId: 5,
        gradeString: "A",
        score: 95,
        feedback: "Strong work",
        webUrl: "https://school.example/grade",
        updatedAt: new Date("2026-07-06T08:00:00.000Z"),
        assignment: {
          elementId: 123,
          title: "Calculus Exam",
          course: {
            itslearningId: 88,
            title: "Math",
          },
        },
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns grades for courses owned by the session user", async () => {
    const response = await GET(new Request("http://localhost/api/grades"));

    expect(response.status).toBe(200);
    expect(mockPrisma.grade.findMany).toHaveBeenCalledWith({
      where: {
        assignment: {
          userId: 42,
        },
      },
      include: {
        assignment: {
          include: {
            course: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    expect(await response.json()).toEqual([
      {
        id: 7,
        assignmentId: 5,
        assignmentElementId: 123,
        assignmentTitle: "Calculus Exam",
        courseId: 88,
        courseTitle: "Math",
        gradeString: "A",
        score: 95,
        feedback: "Strong work",
        webUrl: "https://school.example/grade",
        updatedAt: "2026-07-06T08:00:00.000Z",
      },
    ]);
  });

  it("returns 401 without an active local session", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const response = await GET(new Request("http://localhost/api/grades"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mockPrisma.grade.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 for shared auth session errors", async () => {
    const error = new Error("No active session");
    mockCookies.mockRejectedValue(error);
    mockIsAuthSessionError.mockReturnValue(true);

    const response = await GET(new Request("http://localhost/api/grades"));

    expect(response.status).toBe(401);
    expect(mockIsAuthSessionError).toHaveBeenCalledWith(error);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
