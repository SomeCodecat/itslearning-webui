import mime from "mime-types";

/**
 * itslearning names files after their teacher-entered display title, which
 * often lacks an extension ("Gerund vs infinitive" for a JPEG). Downloads and
 * ZIP entries use that title as the filename, leaving the OS unable to pick an
 * app to open the file with. When we know the real MIME type from the stored
 * blob, append the matching extension.
 */
export function ensureFileExtension(
  name: string,
  mimeType: string | null | undefined,
): string {
  // Trailing whitespace/dots would produce names like "Listening Worksheet .jpg".
  const trimmed = name.replace(/[\s.]+$/, "").trim() || name.trim() || name;

  // Already has a plausible extension → leave it alone.
  if (/\.[a-z0-9]{2,5}$/i.test(trimmed)) {
    return trimmed;
  }

  // octet-stream is "type unknown" — appending .bin would only mislead.
  if (!mimeType || mimeType === "application/octet-stream") {
    return trimmed;
  }

  const ext = mime.extension(mimeType);
  if (!ext) {
    return trimmed;
  }

  // mime-db's canonical extension for image/jpeg is "jpeg"; ".jpg" is the
  // conventional form users expect.
  return `${trimmed}.${ext === "jpeg" ? "jpg" : ext}`;
}
