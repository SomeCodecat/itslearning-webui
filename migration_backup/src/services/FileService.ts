import crypto from "crypto";
import fs from "fs";
import path from "path";

// Mock DB interface since we don't have Prisma Client generated yet
// In real app, import { prisma } from './prisma';

export class FileService {
  private storageDir: string;

  constructor(storageDir: string = "./storage/blobs") {
    this.storageDir = storageDir;
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  // Calculate SHA256 of a buffer
  calculateHash(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  // Handle a downloaded file: Deduplicate -> Store -> Link
  // simplified mock version for Phase 1
  async processFile(
    userId: number,
    fileName: string,
    fileBuffer: Buffer,
    webUrl: string,
    metadata: {
      isExamRelevant?: boolean;
      isAP1?: boolean;
      isAP2?: boolean;
      planId?: number;
      uploadedBy?: string;
      uploadedAt?: Date;
    } = {},
  ) {
    const hash = this.calculateHash(fileBuffer);
    const size = fileBuffer.length;

    console.log(
      `Processing file: ${fileName} (Hash: ${hash.substring(0, 8)}...)`,
    );

    // 1. Check if StoredFile exists (Mock DB Check)
    // const existing = await prisma.storedFile.findUnique({ where: { hash } });
    const existing = false; // Mock

    let storedFileId: number;

    if (existing) {
      console.log(`  -> Deduplicated! Using existing blob.`);
      // storedFileId = existing.id;
      storedFileId = 123; // Mock
    } else {
      console.log(`  -> New File. Saving blob...`);
      // 2. Save blob
      const blobPath = path.join(this.storageDir, hash);
      fs.writeFileSync(blobPath, fileBuffer);

      // 3. Create StoredFile
      // const newFile = await prisma.storedFile.create({ ... });
      storedFileId = 456; // Mock
    }

    // 4. Create UserFile (Link)
    console.log(`  -> Linking UserFile for User ${userId}...`);
    /*
    await prisma.userFile.create({
        data: {
            userId,
            storedFileId,
            customName: fileName,
            webUrl,
            ...metadata
        }
    });
    */

    return { status: "success", hash, storedFileId };
  }
}
