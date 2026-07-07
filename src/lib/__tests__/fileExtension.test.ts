import { describe, expect, it } from "vitest";
import { ensureFileExtension } from "../fileExtension";

describe("ensureFileExtension", () => {
  it("appends an extension derived from the MIME type when missing", () => {
    expect(ensureFileExtension("Gerund vs infinitive", "image/jpeg")).toBe(
      "Gerund vs infinitive.jpg",
    );
    expect(ensureFileExtension("Worksheets", "application/pdf")).toBe(
      "Worksheets.pdf",
    );
  });

  it("leaves names that already have an extension untouched", () => {
    expect(ensureFileExtension("Task 1.pdf", "application/pdf")).toBe(
      "Task 1.pdf",
    );
    expect(
      ensureFileExtension("pros and cons of tourism.pages", "application/octet-stream"),
    ).toBe("pros and cons of tourism.pages");
  });

  it("trims trailing whitespace and dots before appending", () => {
    expect(ensureFileExtension("Listening Worksheet ", "image/jpeg")).toBe(
      "Listening Worksheet.jpg",
    );
    expect(ensureFileExtension("KA2Training..", "application/pdf")).toBe(
      "KA2Training.pdf",
    );
  });

  it("does not invent an extension for unknown or generic MIME types", () => {
    expect(ensureFileExtension("Shark tank", null)).toBe("Shark tank");
    expect(ensureFileExtension("Shark tank", undefined)).toBe("Shark tank");
    expect(
      ensureFileExtension("Shark tank", "application/octet-stream"),
    ).toBe("Shark tank");
  });

  it("does not mistake a trailing number for an extension", () => {
    expect(ensureFileExtension("Version 2.0", "application/pdf")).toBe(
      "Version 2.0.pdf",
    );
  });
});
