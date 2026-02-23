import { NextResponse } from "next/server";
import { getScraperForSession } from "@/lib/userScraper";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Helper to sanitize filenames
function sanitize(name: string) {
  return name.replace(/[^a-z0-9\u00a0-\uffff\-_\.]/gi, "_");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
    }
    const userFileId = parseInt(idParam);

    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get("auth_session");
    if (!userIdCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = parseInt(userIdCookie.value);

    // 1. Find UserFile in DB
    const userFile = await prisma.userFile.findUnique({
      where: { id: userFileId },
      include: { storedFile: true },
    });

    if (!userFile || userFile.userId !== userId) {
      return NextResponse.json(
        { error: "File not found or unauthorized" },
        { status: 404 },
      );
    }

    // 2. Already Downloaded? Stream cleanly from disk
    if (userFile.storedFile) {
      try {
        const fileBuffer = await fs.readFile(userFile.storedFile.localPath);
        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type":
              userFile.storedFile.mimeType || "application/octet-stream",
            "Content-Disposition": `inline; filename="${encodeURIComponent(userFile.customName || "download")}"`,
          },
        });
      } catch (err) {
        console.warn(
          "Proxy: File missing from disk despite having DB record. Re-downloading...",
        );
      }
    }

    // 3. Not Downloaded? Fetch lazily from ITSLearning via our auth token
    if (!userFile.webUrl) {
      return NextResponse.json(
        { error: "No external URL linked to this file for downloading" },
        { status: 400 },
      );
    }

    console.log(`Proxy: Lazily downloading file [${userFile.customName}]...`);
    const scraperService = await getScraperForSession();
    const fileData = await scraperService.downloadFile(userFile.webUrl);

    // 4. Hash & Save to disk
    const filesBaseDir = path.join(process.cwd(), "storage", "files");
    await fs.mkdir(filesBaseDir, { recursive: true });

    const localPath = path.join(filesBaseDir, sanitize(fileData.filename));
    await fs.writeFile(localPath, fileData.buffer);

    const hash = crypto
      .createHash("sha256")
      .update(fileData.buffer)
      .digest("hex");
    const size = BigInt(fileData.buffer.length);

    // 5. Upsert StoredFile
    const storedFile = await prisma.storedFile.upsert({
      where: { hash },
      update: {},
      create: {
        hash,
        size,
        localPath: localPath,
        mimeType: fileData.mimeType,
      },
    });

    // 6. Link UserFile to the physically stored StoredFile
    await prisma.userFile.update({
      where: { id: userFile.id },
      data: { storedFileId: storedFile.id },
    });

    // 7. Stream the fresh payload back sequentially
    return new NextResponse(fileData.buffer as any, {
      headers: {
        "Content-Type": fileData.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileData.filename)}"`,
      },
    });
  } catch (error: any) {
    console.error("File proxy failed:", error);
    return NextResponse.json(
      { error: "Failed to securely download file" },
      { status: 500 },
    );
  }
}
