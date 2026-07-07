import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockCookieGet,
  mockPrisma,
  mockGetScraperForSession,
  mockGetParticipants,
  mockIsAuthSessionError,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    course: {
      findFirst: vi.fn(),
    },
  },
  mockGetScraperForSession: vi.fn(),
  mockGetParticipants: vi.fn(),
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
import { GET } from "../route";

const request = new Request("http://localhost/api/courses/4349/participants");
const params = Promise.resolve({ id: "4349" });

describe("GET /api/courses/[id]/participants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret";
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: signSessionValue(42) });
    mockPrisma.course.findFirst.mockResolvedValue({ id: 9 });
    mockGetScraperForSession.mockResolvedValue({
      getParticipants: mockGetParticipants,
    });
    mockGetParticipants.mockResolvedValue([
      { PersonId: 1, FullName: "Alice", CompletedTasks: 2, TotalTasks: 5 },
    ]);
    mockIsAuthSessionError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns participants for an enrolled course", async () => {
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(mockGetParticipants).toHaveBeenCalledWith(4349);
    expect(await response.json()).toEqual([
      { PersonId: 1, FullName: "Alice", CompletedTasks: 2, TotalTasks: 5 },
    ]);
  });

  it("returns 401 when there is no session", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    expect(mockGetParticipants).not.toHaveBeenCalled();
  });

  it("returns 404 when the course is not owned by the user", async () => {
    mockPrisma.course.findFirst.mockResolvedValue(null);

    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    expect(mockGetParticipants).not.toHaveBeenCalled();
  });

  it("returns 500 for other failures", async () => {
    mockGetParticipants.mockRejectedValue(new Error("upstream failed"));

    const response = await GET(request, { params });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch participants",
    });
  });
});
