import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CourseUpsertArgs = {
  where: {
    itslearningId: number;
  };
};

const {
  mockCookies,
  mockCookieGet,
  mockFsMkdir,
  mockPrisma,
  mockGetScraperForSession,
  mockScraper,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockFsMkdir: vi.fn(),
  mockPrisma: {
    course: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    plan: {
      upsert: vi.fn(),
    },
    userFile: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    assignment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    grade: {
      upsert: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
  mockGetScraperForSession: vi.fn(),
  mockScraper: {
    getCourses: vi.fn(),
    getTasks: vi.fn(),
    getTopics: vi.fn(),
    getResources: vi.fn(),
    getGrades: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mockFsMkdir,
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/userScraper", () => ({
  getScraperForSession: mockGetScraperForSession,
}));

import { POST } from "../route";

describe("POST /api/sync grades integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: "42" });
    mockFsMkdir.mockResolvedValue(undefined);
    mockGetScraperForSession.mockResolvedValue(mockScraper);
    mockScraper.getCourses.mockResolvedValue([
      { CourseId: 100, Title: "Math", Code: "MATH" },
    ]);
    mockScraper.getTasks.mockResolvedValue([]);
    mockScraper.getTopics.mockResolvedValue([]);
    mockScraper.getResources.mockResolvedValue([]);
    mockScraper.getGrades.mockResolvedValue([]);
    mockPrisma.course.upsert.mockImplementation(({ where }: CourseUpsertArgs) =>
      Promise.resolve({ id: where.itslearningId, title: "Math" }),
    );
    mockPrisma.assignment.findUnique.mockResolvedValue(null);
    mockPrisma.assignment.create.mockResolvedValue({ id: 5 });
    mockPrisma.user.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs grades and self-heals missing assignment records", async () => {
    mockScraper.getGrades.mockResolvedValue([
      {
        ElementId: 999,
        Title: "Calculus Exam",
        GradeString: "A",
        Score: 95,
        Feedback: "Strong work",
        Url: "https://school.example/grade",
      },
    ]);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(mockPrisma.assignment.create).toHaveBeenCalledWith({
      data: {
        elementId: 999,
        userId: 42,
        title: "Calculus Exam",
        courseId: 100,
        status: "Completed",
        webUrl: "https://school.example/grade",
      },
    });
    expect(mockPrisma.grade.upsert).toHaveBeenCalledWith({
      where: { assignmentId: 5 },
      update: expect.objectContaining({
        gradeString: "A",
        score: 95,
        feedback: "Strong work",
        webUrl: "https://school.example/grade",
      }),
      create: {
        assignmentId: 5,
        gradeString: "A",
        score: 95,
        feedback: "Strong work",
        webUrl: "https://school.example/grade",
      },
    });
    expect(await response.json()).toEqual({
      success: true,
      timestamp: expect.any(String),
    });
  });

  it("logs a generic grades failure for one course and continues remaining courses", async () => {
    mockScraper.getCourses.mockResolvedValue([
      { CourseId: 100, Title: "Math" },
      { CourseId: 200, Title: "History" },
    ]);
    const error = new Error("Temporary grades failure");
    mockScraper.getGrades.mockRejectedValueOnce(error);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(mockScraper.getGrades).toHaveBeenCalledTimes(2);
    expect(mockScraper.getGrades).toHaveBeenNthCalledWith(1, 100);
    expect(mockScraper.getGrades).toHaveBeenNthCalledWith(2, 200);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Sync: Failed to sync grades for course Math. Skipping grades for this course only.",
      error,
    );
    expect(mockPrisma.grade.upsert).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "skips grades for remaining courses after upstream auth error %i",
    async (status) => {
      mockScraper.getCourses.mockResolvedValue([
        { CourseId: 100, Title: "Math" },
        { CourseId: 200, Title: "History" },
      ]);
      const responseData = { error: "Auth failed" };
      const error = Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status, data: responseData },
      });
      mockScraper.getGrades.mockRejectedValueOnce(error);

      const response = await POST();

      expect(response.status).toBe(200);
      expect(mockScraper.getGrades).toHaveBeenCalledTimes(1);
      expect(mockScraper.getGrades).toHaveBeenCalledWith(100);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(
        "Sync: Failed to sync grades for course Math. Upstream auth error; skipping grades for remaining courses in this run.",
        { status, data: responseData },
      );
      expect(mockPrisma.grade.upsert).not.toHaveBeenCalled();
    },
  );
});
