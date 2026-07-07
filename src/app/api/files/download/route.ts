import { NextResponse } from "next/server";
import { getScraperForSession, isAuthSessionError } from "@/lib/userScraper";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { FileService } from "@/lib/services/FileService";
import { ensureFileExtension } from "@/lib/fileExtension";
import fs from "fs/promises";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");
    // Live-scraped course resources are identified by their itslearning
    // ElementId (they have no stable UserFile.id in the UI), so allow resolving
    // by elementId as well.
    const elementIdParam = searchParams.get("elementId");

    if (!idParam && !elementIdParam) {
      return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
    }

    // Clicking a file card opens it for in-browser viewing (?disposition=inline)
    // so the browser renders it in a tab instead of saving to Downloads. The
    // download button omits this and gets the default attachment behaviour.
    const disposition =
      searchParams.get("disposition") === "inline" ? "inline" : "attachment";

    const userId = await getSessionUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Find UserFile in DB (by elementId for live resources, else by id)
    const userFile = elementIdParam
      ? await prisma.userFile.findFirst({
          where: {
            userId,
            elementId: parseInt(elementIdParam),
            isArchived: false,
          },
          include: { storedFile: true },
          orderBy: { id: "desc" },
        })
      : await prisma.userFile.findUnique({
          where: { id: parseInt(idParam as string) },
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
        return new NextResponse(new Uint8Array(fileBuffer), {
          headers: {
            "Content-Type":
              userFile.storedFile.mimeType || "application/octet-stream",
            "Content-Length": String(fileBuffer.length),
            "Content-Disposition": `${disposition}; filename="${encodeURIComponent(ensureFileExtension(userFile.customName || "download", userFile.storedFile.mimeType))}"`,
          },
        });
      } catch {
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
    return new NextResponse(new Uint8Array(fileData.buffer), {
      headers: {
        "Content-Type": fileData.mimeType || "application/octet-stream",
        "Content-Length": String(fileData.buffer.length),
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(ensureFileExtension(fileData.filename, fileData.mimeType))}"`,
      },
    });
  } catch (error) {
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
