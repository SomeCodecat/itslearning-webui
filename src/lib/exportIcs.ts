export interface IcsEventInput {
  id: string | number;
  title: string;
  description?: string | null;
  from: string | Date;
  to: string | Date;
  location?: string | null;
}

function formatToUtcIcs(dateStrOrObj: string | Date): string {
  const date = new Date(dateStrOrObj);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function escapeIcsText(val: string | null | undefined): string {
  if (!val) return "";
  return val
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/**
 * Builds an ICS calendar file content from events.
 * Line endings are CRLF (\r\n).
 */
export function buildIcs(events: IcsEventInput[], now: Date = new Date()): string {
  const nowStr = formatToUtcIcs(now);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//itslearning-webui//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@itslearning-webui`);
    lines.push(`DTSTAMP:${nowStr}`);
    lines.push(`DTSTART:${formatToUtcIcs(event.from)}`);
    lines.push(`DTEND:${formatToUtcIcs(event.to)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n") + "\r\n";
}
