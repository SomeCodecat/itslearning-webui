import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { isAuthSessionError } from "@/lib/userScraper";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");

    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(userIdCookie.value);

    const grades = await prisma.grade.findMany({
      where: {
        assignment: {
          course: {
            users: {
              some: { id: userId },
            },
          },
        },
      },
      include: {
        assignment: {
          include: {
            course: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const mappedGrades = grades.map((grade: any) => ({
      id: grade.id,
      assignmentId: grade.assignmentId,
      assignmentElementId: grade.assignment.elementId,
      assignmentTitle: grade.assignment.title,
      courseId: grade.assignment.course.itslearningId,
      courseTitle: grade.assignment.course.title,
      gradeString: grade.gradeString,
      score: grade.score,
      feedback: grade.feedback,
      webUrl: grade.webUrl,
      updatedAt: grade.updatedAt.toISOString(),
    }));

    return NextResponse.json(mappedGrades);
  } catch (error: any) {
    console.error("Failed to fetch grades:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch grades" },
      { status: 500 },
    );
  }
}
