import { prisma } from "@/lib/db";
import type { StoredFile, UserFile } from "@prisma/client";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import * as pdf from "pdf-parse";
import mammoth from "mammoth";

const STORAGE_ROOT = "./storage/blobs";

type FileMetadata = {
  customName: string;
  webUrl?: string | null;
  folderPath?: string | null;
  uploader?: string | null;
  uploadedAt?: Date | null;
  mimeType?: string | null;
  isExamRelevant?: boolean;
  isAP1?: boolean;
  isAP2?: boolean;
};

type DownloadTarget = Pick<
  UserFile,
  | "id"
  | "userId"
  | "storedFileId"
  | "planId"
  | "elementId"
  | "customName"
  | "webUrl"
  | "folderPath"
  | "uploader"
  | "uploadedAt"
  | "isExamRelevant"
  | "isAP1"
  | "isAP2"
>;

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
    metadata: FileMetadata,
    userId: number,
    planId?: number,
  ) {
    // 1. Check/Create StoredFile (Physical Layer)
    const storedFile = await this.findOrCreateStoredFile(
      buffer,
      metadata.mimeType,
    );

    // 2. UserFile Resolution (Logical Layer)
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

    // 3. Create new UserFile
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

  /**
   * Attach a lazily downloaded payload to an existing UserFile stub.
   * If the target already pointed at different content, preserve the old row as
   * an archived version and create a fresh active row.
   */
  async attachDownloadedFile(
    userFile: DownloadTarget,
    buffer: Buffer,
    metadata: FileMetadata,
  ): Promise<{ userFile: UserFile; storedFile: StoredFile }> {
    const storedFile = await this.findOrCreateStoredFile(
      buffer,
      metadata.mimeType,
    );

    const fileData = {
      storedFileId: storedFile.id,
      customName: metadata.customName || userFile.customName,
      webUrl: metadata.webUrl ?? userFile.webUrl,
      folderPath: metadata.folderPath ?? userFile.folderPath,
      uploader: metadata.uploader ?? userFile.uploader,
      uploadedAt: metadata.uploadedAt ?? userFile.uploadedAt,
      isExamRelevant: metadata.isExamRelevant ?? userFile.isExamRelevant,
      isAP1: metadata.isAP1 ?? userFile.isAP1,
      isAP2: metadata.isAP2 ?? userFile.isAP2,
    };

    if (userFile.storedFileId && userFile.storedFileId !== storedFile.id) {
      await prisma.userFile.update({
        where: { id: userFile.id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });

      const newUserFile = await prisma.userFile.create({
        data: {
          userId: userFile.userId,
          planId: userFile.planId,
          elementId: userFile.elementId,
          ...fileData,
        },
      });

      return { userFile: newUserFile, storedFile };
    }

    const updatedUserFile = await prisma.userFile.update({
      where: { id: userFile.id },
      data: fileData,
    });

    return { userFile: updatedUserFile, storedFile };
  }

  private async findOrCreateStoredFile(
    buffer: Buffer,
    mimeType?: string | null,
  ): Promise<StoredFile> {
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const size = BigInt(buffer.length);

    let storedFile = await prisma.storedFile.findUnique({
      where: { hash },
    });

    if (storedFile) {
      if (storedFile.localPath) {
        await this.ensureFileOnDisk(storedFile.localPath, buffer);
      }

      if (!storedFile.textContent) {
        const textContent = await this.extractText(buffer, mimeType);
        if (textContent) {
          storedFile = await prisma.storedFile.update({
            where: { id: storedFile.id },
            data: { textContent },
          });
        }
      }

      return storedFile;
    }

    const localPath = path.join(STORAGE_ROOT, hash);
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    await fs.writeFile(localPath, buffer);

    const textContent = await this.extractText(buffer, mimeType);

    return prisma.storedFile.create({
      data: {
        hash,
        size,
        localPath,
        mimeType,
        textContent,
      },
    });
  }

  private async ensureFileOnDisk(localPath: string, buffer: Buffer) {
    try {
      await fs.access(localPath);
    } catch {
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, buffer);
    }
  }

  private async extractText(
    buffer: Buffer,
    mimeType?: string | null,
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
