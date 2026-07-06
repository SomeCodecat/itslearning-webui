import { NextResponse } from "next/server";
import { getScraperForSession } from "@/lib/userScraper";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const courseId = parseInt(id);

    if (isNaN(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
    }

    const scraperService = await getScraperForSession();

    const bulletins = await scraperService.getLightBulletins(courseId);

    return NextResponse.json(bulletins);
  } catch (error) {
    console.error("Failed to fetch bulletins:", error);
    if (error instanceof Error && error.message === "No active session") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch bulletins" },
      { status: 500 },
    );
  }
}
