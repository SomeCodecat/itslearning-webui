import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { mapUserFileForList } from "@/lib/services/FileListMapper";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const userFileId = parseInt(id);

    if (isNaN(userFileId)) {
      return NextResponse.json({ error: "Invalid file ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");
    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = parseInt(userIdCookie.value);

    // Parse and validate body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const allowedKeys = ["isExamRelevant", "isAP1", "isAP2"] as const;
    type FlagKey = (typeof allowedKeys)[number];

    const update: Partial<Record<FlagKey, boolean>> = {};
    for (const key of allowedKeys) {
      if (key in body) {
        if (typeof body[key] !== "boolean") {
          return NextResponse.json(
            { error: `Field "${key}" must be a boolean` },
            { status: 400 },
          );
        }
        update[key] = body[key] as boolean;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // Verify ownership
    const existing = await prisma.userFile.findUnique({
      where: { id: userFileId },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: "File not found or unauthorized" },
        { status: 404 },
      );
    }

    // Apply update
    const updated = await prisma.userFile.update({
      where: { id: userFileId },
      data: update,
      include: {
        storedFile: true,
        plan: {
          include: { course: true },
        },
      },
    });

    return NextResponse.json(mapUserFileForList(updated));
  } catch (error: any) {
    console.error("Failed to update file flags:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
