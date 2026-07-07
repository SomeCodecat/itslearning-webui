import { describe, expect, it } from "vitest";
import { normalizeInstanceUrl } from "../ScraperService";

describe("normalizeInstanceUrl", () => {
  it("prepends https:// when no scheme is present", () => {
    expect(normalizeInstanceUrl("kreisrastatt.itslearning.com")).toBe(
      "https://kreisrastatt.itslearning.com",
    );
  });

  it("strips trailing slashes", () => {
    expect(normalizeInstanceUrl("kreisrastatt.itslearning.com/")).toBe(
      "https://kreisrastatt.itslearning.com",
    );
    expect(normalizeInstanceUrl("https://x.itslearning.com///")).toBe(
      "https://x.itslearning.com",
    );
  });

  it("preserves an existing http/https scheme (case-insensitive)", () => {
    expect(normalizeInstanceUrl("http://foo.example")).toBe(
      "http://foo.example",
    );
    expect(normalizeInstanceUrl("HTTPS://Foo.example/")).toBe(
      "HTTPS://Foo.example",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeInstanceUrl("  sdu.itslearning.com  ")).toBe(
      "https://sdu.itslearning.com",
    );
  });

  it("leaves an empty string empty", () => {
    expect(normalizeInstanceUrl("")).toBe("");
    expect(normalizeInstanceUrl("   ")).toBe("");
  });
});
