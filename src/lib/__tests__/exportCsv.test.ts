import { describe, expect, it } from "vitest";
import { buildCsv } from "../exportCsv";

describe("buildCsv", () => {
  it("prepends UTF-8 BOM", () => {
    const csv = buildCsv(["Header"], [["Value"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("handles basic values and escapes columns correctly", () => {
    const headers = ["Name", "Feedback", "Score"];
    const rows = [
      ["John Doe", "Good, job!", "9.5"],
      ["Jane Doe", 'Excellent "work"', "10"],
      ["Umlauts", "Müller und Grüße", "8"],
    ];

    const csv = buildCsv(headers, rows);
    const cleanCsv = csv.replace(/^\uFEFF/, "");
    const lines = cleanCsv.split("\r\n");

    expect(lines[0]).toBe("Name,Feedback,Score");
    expect(lines[1]).toBe('John Doe,"Good, job!",9.5');
    expect(lines[2]).toBe('Jane Doe,"Excellent ""work""",10');
    expect(lines[3]).toBe('Umlauts,Müller und Grüße,8');
  });

  it("handles empty values and line breaks", () => {
    const headers = ["A", "B"];
    const rows = [
      ["a\nb", ""],
      ["", "x\ry"],
    ];

    const csv = buildCsv(headers, rows);
    const cleanCsv = csv.replace(/^\uFEFF/, "");
    const lines = cleanCsv.split("\r\n");

    expect(lines[0]).toBe("A,B");
    expect(lines[1]).toBe('"a\nb",');
    expect(lines[2]).toBe(',"x\ry"');
  });
});
