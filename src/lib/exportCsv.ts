/**
 * Builds a CSV string with a UTF-8 BOM, correctly quoting and escaping special characters.
 */
export function buildCsv(headers: string[], rows: string[][]): string {
  const escapeCell = (cell: unknown): string => {
    if (cell === null || cell === undefined) {
      return "";
    }
    const stringified = String(cell);
    if (/[",\n\r]/.test(stringified)) {
      return `"${stringified.replace(/"/g, '""')}"`;
    }
    return stringified;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCell).join(","));

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility (umlauts)
  // and use CRLF (\r\n) line endings.
  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}
