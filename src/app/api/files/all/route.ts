import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { mapUserFileForList } from "@/lib/services/FileListMapper";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");

    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(userIdCookie.value);

    const url = request ? request.url : "http://localhost/api/files/all";
    const { searchParams } = new URL(url);
    const courseIdParam = searchParams.get("courseId");
    const courseId = courseIdParam ? parseInt(courseIdParam) : null;

    let courseDbId: number | null = null;
    if (courseId !== null && !isNaN(courseId)) {
      const course = await prisma.course.findUnique({
        where: { itslearningId: courseId },
      });
      courseDbId = course ? course.id : courseId;
    }

    const where: Prisma.UserFileWhereInput = {
      userId,
      ...(courseDbId !== null ? { plan: { courseId: courseDbId } } : {}),
    };

    // Fetch all files for this user
    const userFiles = await prisma.userFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
    console.error("Failed to fetch all files:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
