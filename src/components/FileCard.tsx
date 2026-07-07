"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "./Badge";
import { ProgressBar } from "./ui/ProgressBar";
import { getFileExtension, getFileTone } from "./ui/fileType";
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Tag,
} from "lucide-react";

interface TagItem {
  id: number;
  name: string;
}

interface FileCardProps {
  id: number;
  fileName: string;
  webUrl: string;
  isExamRelevant?: boolean;
  isAP1?: boolean;
  isAP2?: boolean;
  fileSize?: string;
  courseTitle?: string;
  fileType?: string;
  date?: string;
  /** Tags currently assigned to this file */
  tags?: TagItem[];
  /** When true the file exists in the DB and flags can be PATCH-ed */
  persistable?: boolean;
  onFlagsChange?: (updated: {
    isExamRelevant: boolean;
    isAP1: boolean;
    isAP2: boolean;
  }) => void;
  /** Called after tags are changed so parent can mutate its SWR cache */
  onTagsChange?: (updatedTags: TagItem[]) => void;
  /** Highlight this card as a content-matched search result */
  contentMatch?: boolean;
}

export function FileCard({
  id,
  fileName,
  webUrl,
  isExamRelevant: initialExamRelevant = false,
  isAP1: initialAP1 = false,
  isAP2: initialAP2 = false,
  fileSize,
  courseTitle,
  fileType,
  date,
  tags: initialTags = [],
  persistable = true,
  onFlagsChange,
  onTagsChange,
  contentMatch = false,
}: FileCardProps) {
  const t = useTranslations("FileBrowser");

  const [flags, setFlags] = useState({
    isExamRelevant: initialExamRelevant,
    isAP1: initialAP1,
    isAP2: initialAP2,
  });
  const [tags, setTags] = useState<TagItem[]>(initialTags);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Download state. `downloadPct` is null while the server is fetching the file
  // from itslearning (no measurable byte progress yet), then 0–100 as bytes
  // stream to the browser.
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);

  // All user tags (fetched once when the menu opens)
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const showError = (msg: string) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    setErrorMsg(msg);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMsg(null);
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Sync props → state when parent refreshes
  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  useEffect(() => {
    setFlags({
      isExamRelevant: initialExamRelevant,
      isAP1: initialAP1,
      isAP2: initialAP2,
    });
  }, [initialExamRelevant, initialAP1, initialAP2]);

  // Clicking the card opens the file inline in a new tab for quick viewing,
  // without saving it to the Downloads folder. The server serves it with an
  // `inline` disposition so the browser renders (rather than downloads) it.
  function handleView() {
    const query = persistable ? `id=${id}` : `elementId=${id}`;
    window.open(
      `/api/files/download?${query}&disposition=inline`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setDownloadPct(null);
    try {
      // Live-scraped resources (persistable=false) carry the itslearning
      // ElementId rather than a UserFile id, so resolve by elementId there.
      const query = persistable ? `id=${id}` : `elementId=${id}`;
      const res = await fetch(`/api/files/download?${query}`);
      if (!res.ok || !res.body) {
        showError(t("downloadError"));
        return;
      }

      const lenHeader = res.headers.get("Content-Length");
      const totalBytes = lenHeader ? parseInt(lenHeader, 10) : 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (totalBytes > 0) {
            setDownloadPct(Math.min(100, (received / totalBytes) * 100));
          }
        }
      }

      // Derive a filename from Content-Disposition, falling back to the display name.
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename\*?=(?:UTF-8''|")?([^;"']+)/i.exec(disposition);
      let suggested = fileName;
      if (match) {
        try {
          suggested = decodeURIComponent(match[1]);
        } catch {
          suggested = match[1];
        }
      }

      const blob = new Blob(chunks as BlobPart[]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggested || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      showError(t("downloadError"));
    } finally {
      setDownloading(false);
      setDownloadPct(null);
    }
  }

  async function toggleFlag(key: "isExamRelevant" | "isAP1" | "isAP2") {
    if (!persistable || saving) return;
    const next = { ...flags, [key]: !flags[key] };
    // Optimistic update
    setFlags(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) {
        // Rollback on error
        setFlags(flags);
        console.error("Failed to update flag", await res.text());
        showError(t("patchError"));
      } else {
        const updated = await res.json();
        const final = {
          isExamRelevant: updated.isExamRelevant,
          isAP1: updated.isAP1,
          isAP2: updated.isAP2,
        };
        setFlags(final);
        onFlagsChange?.(final);
      }
    } catch (err) {
      setFlags(flags);
      console.error("Network error updating flag", err);
      showError(t("patchError"));
    } finally {
      setSaving(false);
    }
  }

  async function loadAllTags() {
    if (tagsLoaded) return;
    try {
      const res = await fetch("/api/tags");
      if (res.ok) {
        setAllTags(await res.json());
      }
    } catch (err) {
      console.error("Failed to load tags", err);
    }
    setTagsLoaded(true);
  }

  function handleMenuOpen() {
    setMenuOpen((o) => !o);
    if (!tagsLoaded) loadAllTags();
  }

  async function toggleTag(tag: TagItem) {
    if (!persistable || saving) return;
    const isAssigned = tags.some((t) => t.id === tag.id);
    const optimistic = isAssigned
      ? tags.filter((t) => t.id !== tag.id)
      : [...tags, tag];
    setTags(optimistic);
    setSaving(true);
    try {
      const body = isAssigned
        ? { removeTagIds: [tag.id] }
        : { addTagIds: [tag.id] };
      const res = await fetch(`/api/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setTags(tags); // rollback
        console.error("Failed to update tags", await res.text());
        showError(t("patchError"));
      } else {
        const updated = await res.json();
        const newTags: TagItem[] = updated.tags ?? [];
        setTags(newTags);
        onTagsChange?.(newTags);
      }
    } catch (err) {
      setTags(tags);
      console.error("Network error updating tags", err);
      showError(t("patchError"));
    } finally {
      setSaving(false);
    }
  }

  async function createAndAssignTag() {
    const name = newTagName.trim();
    if (!name || creatingTag) return;
    setCreatingTag(true);
    try {
      // Create (or retrieve existing) tag
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok && res.status !== 409) {
        console.error("Failed to create tag", await res.text());
        showError(t("patchError"));
        return;
      }
      const newTag: TagItem = await res.json();
      // Add to global list if it isn't there yet
      setAllTags((prev) =>
        prev.some((t) => t.id === newTag.id) ? prev : [...prev, newTag],
      );
      setNewTagName("");
      // Assign if not already assigned
      if (!tags.some((t) => t.id === newTag.id)) {
        await toggleTag(newTag);
      }
    } catch (err) {
      console.error("Network error creating tag", err);
      showError(t("patchError"));
    } finally {
      setCreatingTag(false);
    }
  }

  const flagItems: {
    key: "isExamRelevant" | "isAP1" | "isAP2";
    label: string;
    color: "red" | "blue";
  }[] = [
    { key: "isExamRelevant", label: t("examRelevant"), color: "red" },
    { key: "isAP1", label: t("ap1"), color: "blue" },
    { key: "isAP2", label: t("ap2"), color: "blue" },
  ];
  const extension = getFileExtension(fileName, fileType);
  const extensionTone = getFileTone(extension);

  return (
    <div
      className={`relative flex items-center justify-between gap-4 rounded-card border bg-card px-[18px] py-[15px] transition-colors max-md:flex-col max-md:items-stretch max-md:gap-3 max-md:px-3.5 max-md:py-[13px] ${
        contentMatch
          ? "border-warning/40"
          : "border-line hover:border-line-strong"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleView}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleView();
          }
        }}
        title={t("viewFile")}
        aria-label={t("viewFile")}
        className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-[9px] font-mono text-[10px] font-bold ${extensionTone} max-md:h-[34px] max-md:w-[34px] max-md:text-[9px]`}>
          {extension || <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="max-w-md truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-accent-text max-md:text-[13px]"
            title={fileName}
          >
            {fileName}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {flags.isAP1 && <Badge label={t("ap1")} color="blue" />}
            {flags.isAP2 && <Badge label={t("ap2")} color="blue" />}
            {flags.isExamRelevant && (
              <Badge label={t("examRelevant")} color="red" />
            )}
            {tags.map((tag) => (
              <Badge key={tag.id} label={tag.name} color="yellow" />
            ))}
            {contentMatch && (
              <Badge label={t("contentMatchedBadge")} variant="content-match" />
            )}
          </div>
          {date && (
            <span className="mt-1 block font-mono text-xs text-text-tertiary">
              {date}
            </span>
          )}
          {(courseTitle || fileType || fileSize) && (
            <span className="mt-0.5 block text-xs text-text-tertiary">
              {[courseTitle, fileType, fileSize].filter(Boolean).join(" · ")}
            </span>
          )}
          {errorMsg && (
            <span className="mt-1 block text-xs font-medium text-error">
              {errorMsg}
            </span>
          )}
          {downloading && (
            <div className="mt-2 max-w-xs">
              <ProgressBar
                value={downloadPct}
                aria-label={t("downloading")}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-none items-center gap-2 max-md:w-full">
        {/* Flag + Tag menu — only shown when the file has a real DB row */}
        {persistable && (
          <div className="relative">
            <button
              ref={triggerRef}
              id={`flag-menu-btn-${id}`}
              aria-label={t("flagMenuLabel")}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={t("flagMenuTitle")}
              onClick={handleMenuOpen}
              disabled={saving}
              className={`flex h-9 w-9 items-center justify-center rounded-control transition-colors ${
                flags.isExamRelevant ||
                flags.isAP1 ||
                flags.isAP2 ||
                tags.length > 0
                  ? "bg-accent-subtle text-accent-text"
                  : "bg-elevated text-text-tertiary hover:bg-elevated-strong hover:text-text-secondary"
              } ${saving ? "opacity-50 cursor-wait" : ""}`}
            >
              <Tag className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  id={`flag-menu-${id}`}
                  className="absolute right-0 top-full z-20 mt-1 min-w-[210px] rounded-control border border-line bg-elevated py-1 shadow-popover"
                >
                  {/* IHK Flags section */}
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                    {t("ihkFlags")}
                  </div>
                  {flagItems.map(({ key, label, color }) => (
                    <button
                      key={key}
                      id={`flag-toggle-${id}-${key}`}
                      role="checkbox"
                      aria-checked={flags[key]}
                      onClick={() => {
                        toggleFlag(key);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-elevated-strong"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          flags[key]
                            ? color === "red"
                              ? "bg-error border-error"
                              : "bg-accent border-accent"
                            : "border-line-strong"
                        }`}
                      >
                        {flags[key] && (
                          <svg
                            className="w-3 h-3 text-white"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2 6l3 3 5-5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span
                        className={
                          flags[key]
                            ? "font-medium text-text-primary"
                            : "text-text-secondary"
                        }
                      >
                        {label}
                      </span>
                    </button>
                  ))}

                  {/* Tags section */}
                  <div className="mt-1 border-t border-line pt-1">
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                      {t("tags")}
                    </div>

                    {/* Existing tags list */}
                    {allTags.length === 0 && tagsLoaded && (
                      <p className="px-3 py-1.5 text-xs text-text-tertiary">
                        {t("noTagsYet")}
                      </p>
                    )}
                    {allTags.map((tag) => {
                      const assigned = tags.some((t) => t.id === tag.id);
                      return (
                        <button
                          key={tag.id}
                          id={`tag-toggle-${id}-${tag.id}`}
                          onClick={() => toggleTag(tag)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-elevated-strong"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              assigned
                                ? "bg-warning border-warning"
                                : "border-line-strong"
                            }`}
                          >
                            {assigned && (
                              <svg
                                className="w-3 h-3 text-white"
                                viewBox="0 0 12 12"
                                fill="none"
                              >
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="truncate text-text-secondary">
                            {tag.name}
                          </span>
                        </button>
                      );
                    })}

                    {/* Create new tag inline */}
                    <div className="px-3 py-2 flex items-center gap-1">
                      <input
                        id={`new-tag-input-${id}`}
                        type="text"
                        placeholder={t("newTagPlaceholder")}
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            createAndAssignTag();
                          }
                        }}
                        className="flex-1 rounded border border-line-strong bg-card px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <button
                        id={`new-tag-btn-${id}`}
                        onClick={createAndAssignTag}
                        disabled={!newTagName.trim() || creatingTag}
                        aria-label={t("createTagLabel")}
                        className="rounded bg-accent p-1.5 text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          aria-label={t("download")}
          className="flex items-center justify-center gap-2 rounded-control bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60 max-md:flex-1"
        >
          {t("download")}
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>
        <a
          href={webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-control bg-elevated px-3.5 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-elevated-strong max-md:h-10 max-md:w-10 max-md:px-0"
          title={t("viewInItslearning")}
        >
          <span className="max-md:sr-only">{t("viewInItslearning")}</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
