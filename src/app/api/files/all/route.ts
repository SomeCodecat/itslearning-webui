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

    // Fetch all files for this user
    const userFiles = await prisma.userFile.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        storedFile: true,
        plan: {
          include: { course: true },
        },
      },
    });

    // Transform to frontend shape
    const files = userFiles.map((f: any) => ({
      id: f.id,
      customName: f.customName || "Untitled",
      webUrl: f.webUrl || "#",
      isExamRelevant: f.isExamRelevant,
      isAP1: f.isAP1,
      isAP2: f.isAP2,
      uploadedAt: f.createdAt.toISOString(),
      size: f.storedFile.size.toString(),
      courseTitle: f.plan?.course.title,
      type: f.storedFile.mimeType,
    }));

    return NextResponse.json(files);
  } catch (error: any) {
    console.error("Failed to fetch all files:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
