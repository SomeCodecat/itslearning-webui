import { prisma } from "@/lib/db";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import mime from "mime-types";
import * as pdf from "pdf-parse";
import mammoth from "mammoth";

const STORAGE_ROOT = "./storage/blobs";

export class FileService {
  constructor() {
    // Ensure storage directory exists
    fs.mkdir(STORAGE_ROOT, { recursive: true }).catch(console.error);
  }

  /**
   * Process a file downloaded from itslearning.
   * Handles Deduplication, Archiving, and Search Indexing.
   */
  async processFile(
    buffer: Buffer,
    metadata: {
      customName: string;
      webUrl?: string; // Deep link to itslearning
      folderPath?: string;
      uploader?: string;
      uploadedAt?: Date;
      mimeType?: string;
      isExamRelevant?: boolean;
      isAP1?: boolean;
      isAP2?: boolean;
    },
    userId: number,
    planId?: number,
  ) {
    // 1. Calculate Hash
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const size = BigInt(buffer.length);

    // 2. Check/Create StoredFile (Physical Layer)
    let storedFile = await prisma.storedFile.findUnique({
      where: { hash },
    });

    if (!storedFile) {
      // New physical file. Save to disk.
      const localPath = path.join(STORAGE_ROOT, hash);
      await fs.writeFile(localPath, buffer);

      // Extract Text for Search
      const textContent = await this.extractText(buffer, metadata.mimeType);

      storedFile = await prisma.storedFile.create({
        data: {
          hash,
          size,
          localPath,
          mimeType: metadata.mimeType,
          textContent,
        },
      });
    }

    // 3. UserFile Resolution (Logical Layer)
    // Check if this user already has a file with this name in this plan/folder
    // If so, and hash is different, archive it.

    // Simplistic duplicate check: Same name + Same Plan (or same folder concept if we tracked folders rigidly, but planId is a good proxy)
    const existingFile = await prisma.userFile.findFirst({
      where: {
        userId,
        planId,
        customName: metadata.customName,
        isArchived: false,
      },
    });

    if (existingFile) {
      if (existingFile.storedFileId === storedFile.id) {
        // Exact same file content and name. No action needed (maybe update metadata timestamp).
        return existingFile;
      } else {
        // Content changed! Archive the old one.
        await prisma.userFile.update({
          where: { id: existingFile.id },
          data: {
            isArchived: true,
            archivedAt: new Date(),
          },
        });
        // Proceed to create new one below
      }
    }

    // 4. Create new UserFile
    return prisma.userFile.create({
      data: {
        userId,
        storedFileId: storedFile.id,
        planId,
        customName: metadata.customName,
        webUrl: metadata.webUrl,
        folderPath: metadata.folderPath,
        uploader: metadata.uploader,
        uploadedAt: metadata.uploadedAt,
        isExamRelevant: metadata.isExamRelevant || false,
        isAP1: metadata.isAP1 || false,
        isAP2: metadata.isAP2 || false,
      },
    });
  }

  private async extractText(
    buffer: Buffer,
    mimeType?: string,
  ): Promise<string | null> {
    try {
      if (mimeType === "application/pdf") {
        // @ts-ignore - pdf-parse has weird exports
        const data = await (pdf.default || pdf)(buffer);
        return data.text.substring(0, 10000); // Cap content size
      } else if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" /* docx */
      ) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value.substring(0, 10000);
      } else if (mimeType?.startsWith("text/")) {
        return buffer.toString("utf-8").substring(0, 10000);
      }
    } catch (e) {
      console.error("Failed to extract text:", e);
    }
    return null;
  }
}
