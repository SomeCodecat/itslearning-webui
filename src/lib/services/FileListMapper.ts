import mime from "mime-types";

export function mapUserFileForList(f: any) {
  const inferredMimeType = f.customName ? mime.lookup(f.customName) : false;

  return {
    id: f.id,
    customName: f.customName || "Untitled",
    webUrl: f.webUrl || "#",
    isExamRelevant: f.isExamRelevant,
    isAP1: f.isAP1,
    isAP2: f.isAP2,
    uploadedAt: f.createdAt.toISOString(),
    size: f.storedFile?.size != null ? f.storedFile.size.toString() : null,
    courseTitle: f.plan?.course.title,
    type: f.storedFile?.mimeType || inferredMimeType || null,
    tags: Array.isArray(f.tags)
      ? (f.tags as { id: number; name: string }[])
      : [],
  };
}
