import { describe, expect, it } from "vitest";
import { buildIcs } from "../exportIcs";

describe("buildIcs", () => {
  it("formats dates and builds valid structure with CRLF", () => {
    const events = [
      {
        id: "event-1",
        title: "Test Event",
        description: "This is a test description; with a semicolon.",
        from: "2026-07-06T12:00:00.000Z",
        to: "2026-07-06T13:00:00.000Z",
      },
    ];
    const fixedNow = new Date("2026-07-06T10:00:00.000Z");

    const ics = buildIcs(events, fixedNow);

    // Verify lines are joined by CRLF
    expect(ics).toContain("\r\n");

    const lines = ics.split("\r\n");
    expect(lines).toContain("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("UID:event-1@itslearning-webui");
    expect(lines).toContain("DTSTAMP:20260706T100000Z");
    expect(lines).toContain("DTSTART:20260706T120000Z");
    expect(lines).toContain("DTEND:20260706T130000Z");
    expect(lines).toContain("SUMMARY:Test Event");
    expect(lines).toContain(
      "DESCRIPTION:This is a test description\\; with a semicolon.",
    );
    expect(lines).toContain("END:VEVENT");
    expect(lines).toContain("END:VCALENDAR");
  });

  it("escapes backslashes, commas, and newlines in text fields", () => {
    const events = [
      {
        id: 2,
        title: "Title with , comma \\ backslash",
        description: "First line\nSecond line\r\nThird line",
        from: new Date("2026-12-25T18:30:00Z"),
        to: new Date("2026-12-25T19:30:00Z"),
        location: "Room 101, Floor 1",
      },
    ];
    const fixedNow = new Date("2026-07-06T10:00:00.000Z");

    const ics = buildIcs(events, fixedNow);
    const lines = ics.split("\r\n");

    expect(lines).toContain("SUMMARY:Title with \\, comma \\\\ backslash");
    expect(lines).toContain("DESCRIPTION:First line\\nSecond line\\nThird line");
    expect(lines).toContain("LOCATION:Room 101\\, Floor 1");
  });
});
