import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { mapUserFileForList } from "@/lib/services/FileListMapper";

/**
 * GET /api/files/search?q=...
 *
 * Session-scoped full-text search.
 * Matches customName OR storedFile.textContent (plain `contains` — SQLite
 * performs LIKE under the hood, which is case-insensitive for ASCII).
 * Empty or <2 char queries return a 400.
 * Results capped at 50, ordered by most recently created first.
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");

    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = parseInt(userIdCookie.value);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";

    if (q.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 },
      );
    }

    const userFiles = await prisma.userFile.findMany({
      where: {
        userId,
        OR: [
          { customName: { contains: q } },
          { storedFile: { textContent: { contains: q } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        storedFile: true,
        plan: {
          include: { course: true },
        },
        tags: { select: { id: true, name: true } },
      },
    });

    // Annotate each result with whether it matched in content (not just name)
    const files = userFiles.map((f) => {
      const mapped = mapUserFileForList(f);
      const lq = q.toLowerCase();
      const nameMatch = (f.customName ?? "").toLowerCase().includes(lq);
      const contentMatch =
        !nameMatch &&
        (f.storedFile?.textContent ?? "").toLowerCase().includes(lq);
      return { ...mapped, contentMatch };
    });

    return NextResponse.json(files);
  } catch (error: any) {
    console.error("Failed to search files:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
