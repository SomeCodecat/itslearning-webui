import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { mockCookies, mockCookieGet, mockPrisma } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieGet: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { signSessionValue } from "@/lib/session";
import { GET, PATCH } from "../route";

describe("/api/user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret";
    mockCookies.mockResolvedValue({ get: mockCookieGet });
    mockCookieGet.mockReturnValue({ value: signSessionValue(42) });
  });

  it("includes email in the current user profile", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      email: "admin@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      itslearningUrl: "https://school.example",
      itslearningUser: "student",
      lastSyncedAt: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        itslearningUrl: true,
        itslearningUser: true,
        lastSyncedAt: true,
      },
    });
    expect(await response.json()).toEqual({
      email: "admin@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      itslearningUrl: "https://school.example",
      itslearningUser: "student",
      lastSyncedAt: null,
    });
  });

  it("updates email with first and last name", async () => {
    mockPrisma.user.update.mockResolvedValue({
      email: "admin@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      lastSyncedAt: null,
    });

    const response = await PATCH(
      new Request("http://localhost/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: " admin@example.com ",
          firstName: " Ada ",
          lastName: " Lovelace ",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: {
        email: "admin@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        lastSyncedAt: true,
      },
    });
  });

  it("rejects invalid profile email", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          firstName: "Ada",
          lastName: "Lovelace",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "A valid email address is required",
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns a conflict when another user has the email", async () => {
    mockPrisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.2",
        meta: { target: ["email"] },
      }),
    );

    const response = await PATCH(
      new Request("http://localhost/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Email address is already in use",
    });
  });
});
