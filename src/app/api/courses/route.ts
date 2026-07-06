import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");

    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(userIdCookie.value);

    // Read from DB
    const courses = await prisma.course.findMany({
      where: {
        users: {
          some: { id: userId },
        },
      },
      orderBy: {
        title: "asc",
      },
    });

    // Transform to match expected frontend/API shape if needed
    // The previous API returned: { CourseId, Title, Code ... } (PascalCase from Scraper)
    // We should probably stick to that or update frontend.
    // Frontend uses: c.CourseId, c.Title (from previous fix).
    // Let's return the same shape to avoid frontend breakage.

    const mappedCourses = courses.map((c) => ({
      CourseId: c.itslearningId,
      Title: c.title,
      Code: c.code,
      // ... add other fields if necessary
    }));

    return NextResponse.json(mappedCourses);
  } catch (error) {
    console.error("Failed to fetch courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 },
    );
  }
}
