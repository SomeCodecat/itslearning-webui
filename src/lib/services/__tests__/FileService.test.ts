import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileService } from "../FileService";
import fs from "fs";

// Hoist mockPrisma
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    storedFile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userFile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    constructor() {
      return mockPrisma;
    }
  },
}));

// Mock fs
vi.mock("fs", async () => {
  const actual: any = await vi.importActual("fs");
  const mockedFs = {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
  return {
    ...mockedFs,
    default: mockedFs,
  };
});

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

    mockPrisma.storedFile.findUnique.mockResolvedValue({ id: 99, hash });
    mockPrisma.userFile.findFirst.mockResolvedValue(null);
    mockPrisma.userFile.create.mockResolvedValue({ id: 200 });

    const result = await fileService.processFile(
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
    // The mock returns `{ id: 200 }` from `userFile.create`, so we just check it was called.
    expect(mockPrisma.userFile.create).toHaveBeenCalled();
  });

  it("should create new StoredFile if not exists", async () => {
    const buffer = Buffer.from("new content");
    const hash =
      "2c299240409743be2d020d0f413348123285741639c09424c80302830f6b404d";

    mockPrisma.storedFile.findUnique.mockResolvedValue(null);
    mockPrisma.storedFile.create.mockResolvedValue({ id: 100, hash });
    mockPrisma.userFile.findFirst.mockResolvedValue(null);
    mockPrisma.userFile.create.mockResolvedValue({ id: 200 });

    const result = await fileService.processFile(
      buffer,
      {
        customName: "new.txt",
        webUrl: "http://example.com",
      },
      1,
    );

    expect(mockPrisma.storedFile.findUnique).toHaveBeenCalled();
    // The mock returns `{ id: 200 }` from `userFile.create`, so we just check it was called.
    expect(mockPrisma.userFile.create).toHaveBeenCalled();
  });
});
