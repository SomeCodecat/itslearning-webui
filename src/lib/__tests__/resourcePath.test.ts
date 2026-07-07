import { describe, expect, it } from "vitest";
import { parseResourcePath } from "../resourcePath";

describe("parseResourcePath", () => {
  it("returns nulls for empty / missing paths", () => {
    expect(parseResourcePath(null)).toEqual({ topic: null, folderPath: null });
    expect(parseResourcePath(undefined)).toEqual({
      topic: null,
      folderPath: null,
    });
    expect(parseResourcePath("")).toEqual({ topic: null, folderPath: null });
  });

  it("returns nulls when the file sits at the course root (course segment only)", () => {
    expect(parseResourcePath(" / FI24-BFKO")).toEqual({
      topic: null,
      folderPath: null,
    });
  });

  it("uses the segment after the course as the topic", () => {
    expect(
      parseResourcePath(" / FI24-BFKO / Programmieren in Java 1 (Stefanski)"),
    ).toEqual({
      topic: "Programmieren in Java 1 (Stefanski)",
      folderPath: "Programmieren in Java 1 (Stefanski)",
    });
  });

  it("keeps the full in-course hierarchy in folderPath but topic is the first level", () => {
    expect(parseResourcePath(" / FI24-BFKO / Cisco / Woche 1 / Slides")).toEqual(
      {
        topic: "Cisco",
        folderPath: "Cisco/Woche 1/Slides",
      },
    );
  });

  it("tolerates missing leading slash and extra whitespace", () => {
    expect(parseResourcePath("FI24-BFKO/Cisco")).toEqual({
      topic: "Cisco",
      folderPath: "Cisco",
    });
  });
});
