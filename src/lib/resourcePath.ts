/**
 * itslearning resource breadcrumbs look like " / FI24-BFKO / Topic / Subfolder".
 * The first segment is the course title; the segment immediately after it is the
 * topic (Planner entry) the resource belongs to, and the remaining segments form
 * the folder hierarchy beneath the course.
 *
 * We derive both the topic (used to link a file to its Plan) and a folderPath
 * (used for by-folder display) from this single field, so no extra API calls are
 * needed to know where a file sits.
 */
export function parseResourcePath(path: string | null | undefined): {
  topic: string | null;
  folderPath: string | null;
} {
  if (!path) return { topic: null, folderPath: null };

  const segments = path
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  // segments[0] is the course title; anything after it is the in-course path.
  const underCourse = segments.slice(1);
  if (underCourse.length === 0) {
    return { topic: null, folderPath: null };
  }

  return {
    topic: underCourse[0],
    folderPath: underCourse.join("/"),
  };
}
