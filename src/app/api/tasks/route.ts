import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const url = request ? request.url : "http://localhost/api/tasks";
    const { searchParams } = new URL(url);
    const status = searchParams.get("status") || "Active";

    const userId = await getSessionUserId();

    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Helper to map status string to DB query if needed.
    // Currently DB stores status string directly from API.

    const courseIdParam = searchParams.get("courseId");
    const courseId = courseIdParam ? parseInt(courseIdParam) : null;

    let courseDbId: number | null = null;
    if (courseId !== null && !isNaN(courseId)) {
      const course = await prisma.course.findUnique({
        where: { itslearningId: courseId },
      });
      courseDbId = course ? course.id : courseId;
    }

    // ITSLearning stores task status as NotStarted/InProgress/Completed.
    // The UI's default "Active" filter means "not completed yet".
    const statusFilter: Prisma.AssignmentWhereInput =
      status === "All"
        ? {}
        : status === "Active"
          ? { status: { in: ["NotStarted", "InProgress"] } }
          : { status };

    const where: Prisma.AssignmentWhereInput = {
      userId,
      ...statusFilter,
      ...(courseDbId !== null ? { courseId: courseDbId } : {}),
    };

    const tasks = await prisma.assignment.findMany({
      where,
      include: {
        course: true,
      },
      orderBy: {
        deadline: "asc",
      },
    });

    // Map to Frontend expected shape
    // Frontend expects: { TaskId, Title, Status, Deadline, Url, CourseTitle ... }
    const mappedTasks = tasks.map((t) => ({
      TaskId: t.elementId,
      Title: t.title,
      Status: t.status,
      Deadline: t.deadline,
      Url: t.webUrl,
      CourseTitle: t.course.title,
    }));

    return NextResponse.json(mappedTasks);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 },
    );
  }
}
