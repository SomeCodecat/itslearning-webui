import { NextResponse } from "next/server";
import { getScraperForSession, isAuthSessionError } from "@/lib/userScraper";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { FileService } from "@/lib/services/FileService";
import fs from "fs";

/**
 * Ensure a set of UserFiles are physically downloaded and stored on disk,
 * streaming per-file progress back as newline-delimited JSON so the client can
 * drive a determinate progress bar. The slow part of a bulk download is the
 * per-file itslearning fetch, so progress is reported one file at a time.
 *
 * Request:  POST { ids: number[] }
 * Response: application/x-ndjson, one object per line:
 *   { "type": "progress", "done": n, "total": m, "name": "...", "ok": true }
 *   { "type": "done", "prepared": a, "failed": b, "alreadyHad": c }
 *
 * After this completes, POST /api/files/zip with the same ids to build the
 * archive from disk.
 */
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.ids)) {
    return NextResponse.json(
      { error: "Invalid body. Expected JSON { ids: number[] }" },
      { status: 400 },
    );
  }

  // Dedupe + coerce to integers so the ownership count check is exact.
  const ids: number[] = Array.from(new Set(body.ids)).filter(
    (n): n is number => typeof n === "number" && Number.isInteger(n),
  );

  if (ids.length === 0) {
    return NextResponse.json({ error: "No file ids provided" }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json(
      { error: "Refused: Cannot prepare more than 500 files at once" },
      { status: 413 },
    );
  }

  // Live-scraped course resources are addressed by itslearning ElementId; the
  // DB-backed file pages use UserFile.id. Both only ever resolve this user's
  // own files (userId filter), so ownership is always enforced.
  const byElement = body.by === "elementId";

  let userFiles;
  if (byElement) {
    userFiles = await prisma.userFile.findMany({
      where: { userId, elementId: { in: ids }, isArchived: false },
      include: { storedFile: true },
    });
    // Lenient: a live resource may not be a downloadable file (e.g. a link or
    // test), so missing ones are simply not prepared rather than a hard 403.
  } else {
    userFiles = await prisma.userFile.findMany({
      where: { userId, id: { in: ids } },
      include: { storedFile: true },
    });
    // Ownership: any id we couldn't load is either missing or not owned.
    if (userFiles.length !== ids.length) {
      return NextResponse.json(
        { error: "Forbidden: Some requested files were not found or not owned by you" },
        { status: 403 },
      );
    }
  }

  // Resolve the scraper up-front so an auth failure returns a clean 401 rather
  // than surfacing mid-stream (where the client has already committed to a 200).
  let scraper: Awaited<ReturnType<typeof getScraperForSession>>;
  try {
    scraper = await getScraperForSession();
  } catch (error) {
    if (isAuthSessionError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Prepare: failed to resolve scraper:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const total = userFiles.length;
  const encoder = new TextEncoder();
  const fileService = new FileService();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let done = 0;
      let prepared = 0;
      let failed = 0;
      let alreadyHad = 0;

      for (const uf of userFiles) {
        const name = uf.customName || "download";

        // Already downloaded and present on disk → nothing to fetch.
        if (
          uf.storedFile &&
          uf.storedFile.localPath &&
          fs.existsSync(uf.storedFile.localPath)
        ) {
          alreadyHad++;
          done++;
          send({ type: "progress", done, total, name, ok: true });
          continue;
        }

        if (!uf.webUrl) {
          failed++;
          done++;
          send({ type: "progress", done, total, name, ok: false });
          continue;
        }

        try {
          const fileData = await scraper.downloadFile(uf.webUrl);
          await fileService.attachDownloadedFile(uf, fileData.buffer, {
            customName: uf.customName || fileData.filename,
            webUrl: uf.webUrl,
            folderPath: uf.folderPath,
            uploader: uf.uploader,
            uploadedAt: uf.uploadedAt,
            mimeType: fileData.mimeType,
            isExamRelevant: uf.isExamRelevant,
            isAP1: uf.isAP1,
            isAP2: uf.isAP2,
          });
          prepared++;
          done++;
          send({ type: "progress", done, total, name, ok: true });
        } catch (error) {
          console.error(`Prepare: failed to download file ${uf.id}:`, error);
          failed++;
          done++;
          send({ type: "progress", done, total, name, ok: false });

          // A dead session will fail every remaining file — stop early.
          if (isAuthSessionError(error)) {
            send({ type: "done", prepared, failed, alreadyHad, aborted: true });
            controller.close();
            return;
          }
        }
      }

      send({ type: "done", prepared, failed, alreadyHad });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
