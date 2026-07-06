import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCookies, mockCookieSet, mockPrisma, mockHashPassword } =
  vi.hoisted(() => {
    type TxClient = {
      user: { count: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    };
    const prismaMock: TxClient & {
      $transaction: ReturnType<typeof vi.fn>;
    } = {
      user: {
        count: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(<T>(cb: (tx: TxClient) => Promise<T>) => cb(prismaMock)),
    };
    return {
      mockCookies: vi.fn(),
      mockCookieSet: vi.fn(),
      mockPrisma: prismaMock,
      mockHashPassword: vi.fn(),
    };
  });

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/passwordHash", () => ({
  hashPassword: mockHashPassword,
}));

import { POST } from "../route";

describe("POST /api/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ set: mockCookieSet });
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.create.mockResolvedValue({ id: 7 });
    mockHashPassword.mockResolvedValue("hashed-password");
  });

  it("creates the first local account and sets the auth session cookie", async () => {
    const response = await POST(
      new Request("http://localhost/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: " admin@example.com ",
          firstName: " Ada ",
          lastName: "",
          password: "secret",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockHashPassword).toHaveBeenCalledWith("secret");
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "admin@example.com",
        passwordHash: "hashed-password",
        firstName: "Ada",
        lastName: null,
      },
      select: { id: true },
    });
    expect(mockCookieSet).toHaveBeenCalledWith("auth_session", "7", {
      httpOnly: true,
      secure: false,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
  });

  it("rejects setup once a user already exists", async () => {
    mockPrisma.user.count.mockResolvedValue(1);

    const response = await POST(
      new Request("http://localhost/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          password: "secret",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Setup already completed",
    });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("requires a valid email address", async () => {
    const response = await POST(
      new Request("http://localhost/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          firstName: "Ada",
          lastName: "Lovelace",
          password: "secret",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "A valid email address is required",
    });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
