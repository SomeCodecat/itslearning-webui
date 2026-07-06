import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { isAuthSessionError } from "@/lib/userScraper";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request ? request.url : "http://localhost/api/grades";
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

    const where: Prisma.GradeWhereInput = {
      assignment: {
        userId,
        ...(courseDbId !== null ? { courseId: courseDbId } : {}),
      },
    };

    const grades = await prisma.grade.findMany({
      where,
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

    const mappedGrades = grades.map((grade) => ({
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
  } catch (error) {
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
