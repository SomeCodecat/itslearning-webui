import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieGet,
  mockPrisma,
  mockGetScraperForSession,
  mockSetCourseFavorite,
  mockIsAuthSessionError,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    course: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  mockGetScraperForSession: vi.fn(),
  mockSetCourseFavorite: vi.fn(),
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

import { signSessionValue } from "@/lib/session";
import { PUT } from "../route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/courses/4349/favorite", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "4349" });

describe("PUT /api/courses/[id]/favorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret";
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: signSessionValue(42) });
    mockPrisma.course.findFirst.mockResolvedValue({
      id: 9,
      itslearningId: 4349,
      isStarred: false,
    });
    mockPrisma.course.update.mockResolvedValue({
      itslearningId: 4349,
      isStarred: true,
    });
    mockGetScraperForSession.mockResolvedValue({
      setCourseFavorite: mockSetCourseFavorite,
    });
    mockSetCourseFavorite.mockResolvedValue(undefined);
    mockIsAuthSessionError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stars a course and persists the state", async () => {
    const response = await PUT(makeRequest({ favorite: true }), { params });

    expect(response.status).toBe(200);
    expect(mockSetCourseFavorite).toHaveBeenCalledWith(4349, true);
    expect(mockPrisma.course.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { isStarred: true },
      select: { itslearningId: true, isStarred: true },
    });
    expect(await response.json()).toEqual({
      CourseId: 4349,
      IsStarred: true,
    });
  });

  it("returns 400 when favorite is not a boolean", async () => {
    const response = await PUT(makeRequest({ favorite: "yes" }), { params });

    expect(response.status).toBe(400);
    expect(mockSetCourseFavorite).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no session", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const response = await PUT(makeRequest({ favorite: true }), { params });

    expect(response.status).toBe(401);
    expect(mockPrisma.course.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the course is not owned by the user", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const response = await PUT(makeRequest({ favorite: true }), { params });

    expect(response.status).toBe(404);
    expect(mockSetCourseFavorite).not.toHaveBeenCalled();
  });

  it("returns 401 for auth session errors", async () => {
    const error = new Error("No active session");
    mockGetScraperForSession.mockRejectedValue(error);
    mockIsAuthSessionError.mockReturnValue(true);

    const response = await PUT(makeRequest({ favorite: true }), { params });

    expect(response.status).toBe(401);
    expect(mockIsAuthSessionError).toHaveBeenCalledWith(error);
  });

  it("returns 500 for other failures", async () => {
    mockSetCourseFavorite.mockRejectedValue(new Error("upstream failed"));

    const response = await PUT(makeRequest({ favorite: true }), { params });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to update favorite",
    });
  });
});
