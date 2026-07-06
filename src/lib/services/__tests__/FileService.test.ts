import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileService } from "../FileService";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    storedFile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userFile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("fs/promises", () => ({
  default: mockFs,
}));

describe("FileService", () => {
  let fileService: FileService;

  beforeEach(() => {
    vi.clearAllMocks();
    fileService = new FileService();
  });

  it("should deduplicate existing files", async () => {
    const buffer = Buffer.from("test content");
    const hash =
      "6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72";

    mockPrisma.storedFile.findUnique.mockResolvedValue({
      id: 99,
      hash,
      localPath: "./storage/blobs/existing",
      textContent: "indexed",
    });
    mockPrisma.userFile.findFirst.mockResolvedValue(null);
    mockPrisma.userFile.create.mockResolvedValue({ id: 200 });

    await fileService.processFile(
      buffer,
      {
        customName: "test.txt",
        webUrl: "http://example.com",
      },
      1,
    );

    expect(mockPrisma.storedFile.findUnique).toHaveBeenCalledWith({
      where: { hash },
    });
    expect(mockPrisma.storedFile.create).not.toHaveBeenCalled();
    expect(mockPrisma.userFile.create).toHaveBeenCalled();
  });

  it("should create new StoredFile with extracted text if not exists", async () => {
    const buffer = Buffer.from("new content");
    const hash =
      "fe32608c9ef5b6cf7e3f946480253ff76f24f4ec0678f3d0f07f9844cbff9601";

    mockPrisma.storedFile.findUnique.mockResolvedValue(null);
    mockPrisma.storedFile.create.mockResolvedValue({ id: 100, hash });
    mockPrisma.userFile.findFirst.mockResolvedValue(null);
    mockPrisma.userFile.create.mockResolvedValue({ id: 200 });

    await fileService.processFile(
      buffer,
      {
        customName: "new.txt",
        webUrl: "http://example.com",
        mimeType: "text/plain",
      },
      1,
    );

    expect(mockPrisma.storedFile.findUnique).toHaveBeenCalled();
    expect(mockPrisma.storedFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hash,
        size: BigInt(buffer.length),
        mimeType: "text/plain",
        textContent: "new content",
      }),
    });
    expect(mockPrisma.userFile.create).toHaveBeenCalled();
  });

  it("should attach downloaded content to an existing stub", async () => {
    const buffer = Buffer.from("downloaded");
    const storedFile = {
      id: 300,
      hash: "hash",
      localPath: "./storage/blobs/hash",
      textContent: "indexed",
    };
    const userFile = {
      id: 20,
      userId: 1,
      storedFileId: null,
      planId: 5,
      elementId: 123,
      customName: "lesson.txt",
      webUrl: "http://example.com/file",
      folderPath: null,
      uploader: "System",
      uploadedAt: null,
      isExamRelevant: false,
      isAP1: false,
      isAP2: true,
    };

    mockPrisma.storedFile.findUnique.mockResolvedValue(storedFile);
    mockPrisma.userFile.update.mockResolvedValue({
      ...userFile,
      storedFileId: storedFile.id,
    });

    const result = await fileService.attachDownloadedFile(userFile, buffer, {
      customName: userFile.customName,
      webUrl: userFile.webUrl,
      mimeType: "text/plain",
    });

    expect(mockPrisma.userFile.update).toHaveBeenCalledWith({
      where: { id: userFile.id },
      data: expect.objectContaining({
        storedFileId: storedFile.id,
        customName: "lesson.txt",
        webUrl: "http://example.com/file",
      }),
    });
    expect(mockPrisma.userFile.create).not.toHaveBeenCalled();
    expect(result.storedFile).toBe(storedFile);
  });

  it("should archive a linked file when downloaded content supersedes it", async () => {
    const buffer = Buffer.from("new version");
    const storedFile = {
      id: 301,
      hash: "new-hash",
      localPath: "./storage/blobs/new-hash",
      textContent: "indexed",
    };
    const userFile = {
      id: 21,
      userId: 1,
      storedFileId: 100,
      planId: 5,
      elementId: 124,
      customName: "lesson.txt",
      webUrl: "http://example.com/file",
      folderPath: "Week 1",
      uploader: "System",
      uploadedAt: null,
      isExamRelevant: true,
      isAP1: true,
      isAP2: false,
    };

    mockPrisma.storedFile.findUnique.mockResolvedValue(storedFile);
    mockPrisma.userFile.update.mockResolvedValue({
      ...userFile,
      isArchived: true,
    });
    mockPrisma.userFile.create.mockResolvedValue({
      ...userFile,
      id: 22,
      storedFileId: storedFile.id,
    });

    await fileService.attachDownloadedFile(userFile, buffer, {
      customName: userFile.customName,
      webUrl: userFile.webUrl,
      folderPath: userFile.folderPath,
      uploader: userFile.uploader,
      uploadedAt: userFile.uploadedAt,
      mimeType: "text/plain",
      isExamRelevant: userFile.isExamRelevant,
      isAP1: userFile.isAP1,
      isAP2: userFile.isAP2,
    });

    expect(mockPrisma.userFile.update).toHaveBeenCalledWith({
      where: { id: userFile.id },
      data: {
        isArchived: true,
        archivedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.userFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: userFile.userId,
        planId: userFile.planId,
        elementId: userFile.elementId,
        storedFileId: storedFile.id,
      }),
    });
  });
});
