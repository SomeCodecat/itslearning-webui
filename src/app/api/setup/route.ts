import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/passwordHash";
import { setSessionCookie } from "@/lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const existingUsers = await tx.user.count();

      if (existingUsers > 0) {
        return null;
      }

      return tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: normalizeOptionalText(body.firstName),
          lastName: normalizeOptionalText(body.lastName),
        },
        select: { id: true },
      });
    });

    if (!user) {
      return NextResponse.json(
        { error: "Setup already completed" },
        { status: 409 },
      );
    }

    await setSessionCookie(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email address is already in use" },
        { status: 409 },
      );
    }

    console.error("Setup failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
