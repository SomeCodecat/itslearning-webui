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

    // Fetch recent files for this user
    const userFiles = await prisma.userFile.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        storedFile: true,
        plan: {
          include: { course: true },
        },
      },
    });

    // Transform to frontend shape if needed
    // Assuming FrontEnd expects: id, customName, webUrl, isExamRelevant, etc.
    const files = userFiles.map((f: any) => ({
      id: f.id,
      customName: f.customName || "Untitled",
      webUrl: f.webUrl || "#",
      isExamRelevant: f.isExamRelevant,
      isAP1: f.isAP1,
      isAP2: f.isAP2,
      uploadedAt: f.createdAt.toISOString(),
      size: f.storedFile.size.toString(), // BigInt to string
      courseTitle: f.plan?.course.title,
      type: f.storedFile.mimeType,
    }));

    return NextResponse.json(files);
  } catch (error: any) {
    console.error("Failed to fetch recent files:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
