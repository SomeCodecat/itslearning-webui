import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { Readable } from "stream";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse requested IDs
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.ids)) {
      return NextResponse.json(
        { error: "Invalid body. Expected JSON { ids: number[] }" },
        { status: 400 },
      );
    }

    const ids: number[] = body.ids;

    // Refuse more than 500 files
    if (ids.length > 500) {
      return NextResponse.json(
        { error: "Refused: Cannot zip more than 500 files at once" },
        { status: 413 },
      );
    }

    // Load UserFiles and storedFiles for ownership verification
    const userFiles = await prisma.userFile.findMany({
      where: {
        userId,
        id: { in: ids },
      },
      include: {
        storedFile: true,
      },
    });

    // Verify ownership: if some IDs were not found, it means they are either missing or not owned by user
    if (userFiles.length !== ids.length) {
      return NextResponse.json(
        { error: "Forbidden: Some requested files were not found or not owned by you" },
        { status: 403 },
      );
    }

    // Refuse if total size > 2GB
    let totalSize = BigInt(0);
    for (const uf of userFiles) {
      if (uf.storedFile) {
        totalSize += BigInt(uf.storedFile.size);
      }
    }

    if (totalSize > BigInt(2) * BigInt(1024) * BigInt(1024) * BigInt(1024)) {
      return NextResponse.json(
        { error: "Refused: Total file size exceeds 2GB limit" },
        { status: 413 },
      );
    }

    // Determine files to pack and count skipped ones
    let skippedCount = 0;
    const filesToPack: { localPath: string; zipPath: string }[] = [];
    const seenPaths = new Set<string>();

    for (const uf of userFiles) {
      if (!uf.storedFile || !uf.storedFile.localPath) {
        skippedCount++;
        continue;
      }

      if (!fs.existsSync(uf.storedFile.localPath)) {
        skippedCount++;
        continue;
      }

      // Display name
      const displayName = uf.customName || "Untitled";
      // Sanitize filename characters: remove invalid path characters
      const sanitizedName = displayName.replace(/[\/\\?%*:|"<>]/g, "_");

      // Construct ZIP folder structure from folderPath
      let zipPath = sanitizedName;
      if (uf.folderPath) {
        const folders = uf.folderPath
          .split(/[\/\\]/)
          .map((f) => f.trim())
          .filter((f) => f && f !== "." && f !== "..");

        if (folders.length > 0) {
          zipPath = path.join(...folders, sanitizedName);
        }
      }

      // Deduplicate file names to avoid collisions in the ZIP
      let finalZipPath = zipPath;
      let counter = 1;
      const parsedPath = path.parse(zipPath);

      while (seenPaths.has(finalZipPath)) {
        const suffix = ` (${counter++})`;
        if (parsedPath.dir) {
          finalZipPath = path.join(
            parsedPath.dir,
            `${parsedPath.name}${suffix}${parsedPath.ext}`,
          );
        } else {
          finalZipPath = `${parsedPath.name}${suffix}${parsedPath.ext}`;
        }
      }

      seenPaths.add(finalZipPath);
      filesToPack.push({
        localPath: uf.storedFile.localPath,
        zipPath: finalZipPath,
      });
    }

    const archive = archiver("zip", { zlib: { level: 9 } });

    // Handle archive errors gracefully
    archive.on("error", (err) => {
      console.error("Archiver compression error:", err);
    });

    // Add files to the archive
    for (const file of filesToPack) {
      archive.file(file.localPath, { name: file.zipPath });
    }

    // Begin finalization (non-blocking)
    archive.finalize();

    // Convert standard Node stream into Web-compliant ReadableStream
    const webStream = Readable.toWeb(archive);

    return new Response(webStream as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="files.zip"',
        "X-Skipped-Files": String(skippedCount),
      },
    });
  } catch (error) {
    console.error("Failed to generate files zip archive:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
