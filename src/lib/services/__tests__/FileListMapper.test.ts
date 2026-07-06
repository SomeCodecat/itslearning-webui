import { describe, expect, it } from "vitest";
import { mapUserFileForList } from "../FileListMapper";

describe("mapUserFileForList", () => {
  it("keeps freshly synced files listable without StoredFile metadata", () => {
    const createdAt = new Date("2026-01-02T03:04:05.000Z");

    const result = mapUserFileForList({
      id: 1,
      customName: "lesson.pdf",
      webUrl: "https://example.com/lesson.pdf",
      isExamRelevant: false,
      isAP1: true,
      isAP2: false,
      createdAt,
      storedFile: null,
      plan: { course: { title: "Math" } },
    });

    expect(result).toMatchObject({
      id: 1,
      customName: "lesson.pdf",
      webUrl: "https://example.com/lesson.pdf",
      uploadedAt: createdAt.toISOString(),
      size: null,
      type: "application/pdf",
      courseTitle: "Math",
    });
  });

  it("uses StoredFile size and mime type when the file is downloaded", () => {
    const result = mapUserFileForList({
      id: 2,
      customName: "notes.txt",
      webUrl: null,
      isExamRelevant: true,
      isAP1: false,
      isAP2: true,
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      storedFile: {
        size: BigInt(123),
        mimeType: "text/plain",
      },
      plan: null,
    });

    expect(result.size).toBe("123");
    expect(result.type).toBe("text/plain");
    expect(result.webUrl).toBe("#");
  });
});
