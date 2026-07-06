import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import {
  getScraperForSession,
  isAuthSessionError,
} from "@/lib/userScraper";

function assignmentOwnershipWhere(userId: number) {
  return {
    course: {
      users: {
        some: { id: userId },
      },
    },
  };
}

async function findAssignmentForUser(assignmentId: number, userId: number) {
  const ownershipWhere = assignmentOwnershipWhere(userId);
  const include = { course: true };

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      ...ownershipWhere,
    },
    include,
  });

  if (assignment) {
    return assignment;
  }

  // The existing list route exposes TaskId as elementId, not the local row id.
  return prisma.assignment.findFirst({
    where: {
      elementId: assignmentId,
      ...ownershipWhere,
    },
    include,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const assignmentId = parseInt(id, 10);

    if (isNaN(assignmentId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");

    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(userIdCookie.value, 10);
    const assignment = await findAssignmentForUser(assignmentId, userId);

    if (!assignment?.elementId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const scraperService = await getScraperForSession();
    const details = await scraperService.getAssignmentDetails(
      assignment.elementId,
    );

    return NextResponse.json({
      ...assignment,
      details,
    });
  } catch (error) {
    console.error("Failed to fetch task details:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch task details" },
      { status: 500 },
    );
  }
}
