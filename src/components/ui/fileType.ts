export function getFileExtension(name: string, type?: string): string {
  const ext =
    (name.includes(".") && name.split(".").pop()) ||
    (type?.includes("/") ? type.split("/").pop() : type) ||
    "FILE";
  return ext.replace(/^\./, "").slice(0, 4).toUpperCase();
}

export function getFileTone(ext: string): string {
  if (ext.startsWith("XL")) return "bg-success-subtle text-success";
  if (ext.startsWith("PP")) return "bg-sky-subtle text-sky";
  if (ext.startsWith("DO")) return "bg-warning-subtle text-warning";
  return "bg-accent-subtle text-accent-text";
}
