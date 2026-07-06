import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  getScraperForSession,
  isAuthSessionError,
} from "@/lib/userScraper";

// Toggle / set a course's favourite (starred) state. Body: { favorite: boolean }.
// The upstream itslearning endpoint only offers a stateful toggle, so the
// scraper reconciles current→desired; here we persist the result to our DB so
// the course list reflects it without a full re-sync.
export async function PUT(
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

    // Course must belong to this user.
    const course = await prisma.course.findFirst({
      where: { itslearningId: courseId, users: { some: { id: userId } } },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    let favorite: boolean;
    try {
      const body = (await request.json()) as { favorite?: unknown };
      if (typeof body.favorite !== "boolean") {
        return NextResponse.json(
          { error: "Body must include a boolean 'favorite'" },
          { status: 400 },
        );
      }
      favorite = body.favorite;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const scraperService = await getScraperForSession();
    await scraperService.setCourseFavorite(courseId, favorite);

    const updated = await prisma.course.update({
      where: { id: course.id },
      data: { isStarred: favorite },
      select: { itslearningId: true, isStarred: true },
    });

    return NextResponse.json({
      CourseId: updated.itslearningId,
      IsStarred: updated.isStarred,
    });
  } catch (error) {
    console.error("Failed to set course favorite:", error);

    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to update favorite" },
      { status: 500 },
    );
  }
}
