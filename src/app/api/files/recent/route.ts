import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { mapUserFileForList } from "@/lib/services/FileListMapper";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");

    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(userIdCookie.value);

    // Fetch recent files for this user
    const userFiles = await prisma.userFile.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        storedFile: true,
        plan: {
          include: { course: true },
        },
        tags: { select: { id: true, name: true } },
      },
    });

    const files = userFiles.map(mapUserFileForList);

    return NextResponse.json(files);
  } catch (error) {
    console.error("Failed to fetch recent files:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
