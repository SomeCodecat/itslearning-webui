import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
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

    const userId = await getSessionUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const allowedFlags = ["isExamRelevant", "isAP1", "isAP2"] as const;
    type FlagKey = (typeof allowedFlags)[number];

    const flagUpdate: Partial<Record<FlagKey, boolean>> = {};
    for (const key of allowedFlags) {
      if (key in body) {
        if (typeof body[key] !== "boolean") {
          return NextResponse.json(
            { error: `Field "${key}" must be a boolean` },
            { status: 400 },
          );
        }
        flagUpdate[key] = body[key] as boolean;
      }
    }

    // Tag assignment fields
    const addTagIds = body.addTagIds;
    const removeTagIds = body.removeTagIds;

    const hasAddTags =
      Array.isArray(addTagIds) && addTagIds.length > 0;
    const hasRemoveTags =
      Array.isArray(removeTagIds) && removeTagIds.length > 0;

    // Validate that at least one kind of update is provided
    if (
      Object.keys(flagUpdate).length === 0 &&
      !hasAddTags &&
      !hasRemoveTags
    ) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // Validate tag ID arrays contain numbers
    if (
      addTagIds !== undefined &&
      (!Array.isArray(addTagIds) ||
        (addTagIds as unknown[]).some((v) => typeof v !== "number"))
    ) {
      return NextResponse.json(
        { error: "addTagIds must be an array of numbers" },
        { status: 400 },
      );
    }
    if (
      removeTagIds !== undefined &&
      (!Array.isArray(removeTagIds) ||
        (removeTagIds as unknown[]).some((v) => typeof v !== "number"))
    ) {
      return NextResponse.json(
        { error: "removeTagIds must be an array of numbers" },
        { status: 400 },
      );
    }

    // Verify file ownership
    const existing = await prisma.userFile.findUnique({
      where: { id: userFileId },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: "File not found or unauthorized" },
        { status: 404 },
      );
    }

    // Validate tag ownership for addTagIds
    if (hasAddTags) {
      const ownedTags = await prisma.tag.findMany({
        where: { id: { in: addTagIds as number[] }, userId },
        select: { id: true },
      });
      if (ownedTags.length !== (addTagIds as number[]).length) {
        return NextResponse.json(
          { error: "One or more tags not found or not owned by user" },
          { status: 403 },
        );
      }
    }

    // Validate tag ownership for removeTagIds
    if (hasRemoveTags) {
      const ownedTags = await prisma.tag.findMany({
        where: { id: { in: removeTagIds as number[] }, userId },
        select: { id: true },
      });
      if (ownedTags.length !== (removeTagIds as number[]).length) {
        return NextResponse.json(
          { error: "One or more tags not found or not owned by user" },
          { status: 403 },
        );
      }
    }

    // Build update data
    const tagConnect = hasAddTags
      ? { connect: (addTagIds as number[]).map((id) => ({ id })) }
      : undefined;
    const tagDisconnect = hasRemoveTags
      ? { disconnect: (removeTagIds as number[]).map((id) => ({ id })) }
      : undefined;

    // Apply update
    const updated = await prisma.userFile.update({
      where: { id: userFileId },
      data: {
        ...flagUpdate,
        ...(tagConnect || tagDisconnect
          ? { tags: { ...tagConnect, ...tagDisconnect } }
          : {}),
      },
      include: {
        storedFile: true,
        plan: {
          include: { course: true },
        },
        tags: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(mapUserFileForList(updated));
  } catch (error) {
    console.error("Failed to update file flags:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
