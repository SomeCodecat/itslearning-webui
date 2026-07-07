import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  getScraperForSession,
  isAuthSessionError,
} from "@/lib/userScraper";

// Course roster with per-person task progress (courses/{id}/participants/v3).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const courseId = Number(id);

    if (!Number.isInteger(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
    }

    const userId = await getSessionUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only expose participants for a course this user is enrolled in.
    const course = await prisma.course.findFirst({
      where: { itslearningId: courseId, users: { some: { id: userId } } },
      select: { id: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const scraperService = await getScraperForSession();
    const participants = await scraperService.getParticipants(courseId);

    return NextResponse.json(participants);
  } catch (error) {
    console.error("Failed to fetch participants:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch participants" },
      { status: 500 },
    );
  }
}
