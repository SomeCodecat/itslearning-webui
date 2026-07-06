import mime from "mime-types";

export interface UserFileForList {
  id: number;
  customName: string | null;
  webUrl: string | null;
  isExamRelevant: boolean;
  isAP1: boolean;
  isAP2: boolean;
  createdAt: Date;
  storedFile?: {
    size?: { toString(): string } | null;
    mimeType?: string | null;
  } | null;
  plan?: {
    course: {
      title: string;
    };
  } | null;
  tags?: { id: number; name: string }[];
}

export function mapUserFileForList(f: UserFileForList) {
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
    tags: Array.isArray(f.tags) ? f.tags : [],
  };
}
