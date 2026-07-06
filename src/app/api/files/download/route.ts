import { NextResponse } from "next/server";
import { getScraperForSession, isAuthSessionError } from "@/lib/userScraper";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import fs from "fs/promises";
import { FileService } from "@/lib/services/FileService";

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

    // 4. Store physical content through FileService and link this UserFile
    const fileService = new FileService();
    await fileService.attachDownloadedFile(userFile, fileData.buffer, {
      customName: userFile.customName || fileData.filename,
      webUrl: userFile.webUrl,
      folderPath: userFile.folderPath,
      uploader: userFile.uploader,
      uploadedAt: userFile.uploadedAt,
      mimeType: fileData.mimeType,
      isExamRelevant: userFile.isExamRelevant,
      isAP1: userFile.isAP1,
      isAP2: userFile.isAP2,
    });

    // 5. Stream the fresh payload back sequentially
    return new NextResponse(fileData.buffer as any, {
      headers: {
        "Content-Type": fileData.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileData.filename)}"`,
      },
    });
  } catch (error: any) {
    console.error("File proxy failed:", error);
    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to securely download file" },
      { status: 500 },
    );
  }
}
