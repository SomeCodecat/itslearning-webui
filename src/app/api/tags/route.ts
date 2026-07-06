import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

/** GET /api/tags — list all tags belonging to the session user */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");
    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = parseInt(userIdCookie.value);

    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json(tags);
  } catch (error: any) {
    console.error("Failed to fetch tags:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/** POST /api/tags — create a tag (trim, non-empty, dedupe by name per user) */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");
    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = parseInt(userIdCookie.value);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Tag name must be a non-empty string" },
        { status: 400 },
      );
    }

    // Check for existing tag with same name for this user
    const existing = await prisma.tag.findUnique({
      where: { userId_name: { userId, name } },
      select: { id: true, name: true },
    });

    if (existing) {
      // Return existing tag with 409
      return NextResponse.json(existing, { status: 409 });
    }

    const tag = await prisma.tag.create({
      data: { name, userId },
      select: { id: true, name: true },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create tag:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
