import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

/** DELETE /api/tags/[id] — delete own tag; disconnects from files automatically */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }

    const userId = await getSessionUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
      select: { id: true, userId: true },
    });

    if (!tag || tag.userId !== userId) {
      return NextResponse.json(
        { error: "Tag not found or unauthorized" },
        { status: 404 },
      );
    }

    // Prisma handles the many-to-many disconnect automatically on delete
    await prisma.tag.delete({ where: { id: tagId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete tag:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
