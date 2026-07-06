"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "./Badge";
import { Tag, Plus } from "lucide-react";

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

  return (
    <div
      className={`relative flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border transition-shadow hover:shadow-md ${
        contentMatch
          ? "border-amber-300 dark:border-amber-700"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 flex-shrink-0">
          {/* Placeholder Icon */}
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <h3
            className="font-medium text-gray-900 dark:text-white truncate max-w-md"
            title={fileName}
          >
            {fileName}
          </h3>
          <div className="flex gap-2 mt-1 flex-wrap">
            {flags.isAP1 && <Badge label={t("ap1")} color="blue" />}
            {flags.isAP2 && <Badge label={t("ap2")} color="blue" />}
            {flags.isExamRelevant && (
              <Badge label={t("examRelevant")} color="red" />
            )}
            {tags.map((tag) => (
              <Badge key={tag.id} label={tag.name} color="yellow" />
            ))}
            {contentMatch && (
              <Badge label={t("contentMatchedBadge")} color="gray" />
            )}
          </div>
          {date && (
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
              {date}
            </span>
          )}
          {(courseTitle || fileType || fileSize) && (
            <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 block">
              {[courseTitle, fileType, fileSize].filter(Boolean).join(" · ")}
            </span>
          )}
          {errorMsg && (
            <span className="text-xs text-red-500 dark:text-red-400 mt-1 block font-medium">
              {errorMsg}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3 items-center flex-shrink-0">
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
              className={`p-2 rounded-md transition-colors ${
                flags.isExamRelevant ||
                flags.isAP1 ||
                flags.isAP2 ||
                tags.length > 0
                  ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                  className="absolute right-0 top-full mt-1 z-20 min-w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
                >
                  {/* IHK Flags section */}
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          flags[key]
                            ? color === "red"
                              ? "bg-red-500 border-red-500"
                              : "bg-blue-500 border-blue-500"
                            : "border-gray-300 dark:border-gray-600"
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
                            ? "text-gray-900 dark:text-white font-medium"
                            : "text-gray-600 dark:text-gray-300"
                        }
                      >
                        {label}
                      </span>
                    </button>
                  ))}

                  {/* Tags section */}
                  <div className="mt-1 border-t border-gray-100 dark:border-gray-700 pt-1">
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {t("tags")}
                    </div>

                    {/* Existing tags list */}
                    {allTags.length === 0 && tagsLoaded && (
                      <p className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500">
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
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              assigned
                                ? "bg-yellow-400 border-yellow-400"
                                : "border-gray-300 dark:border-gray-600"
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
                          <span className="text-gray-700 dark:text-gray-300 truncate">
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
                        className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        id={`new-tag-btn-${id}`}
                        onClick={createAndAssignTag}
                        disabled={!newTagName.trim() || creatingTag}
                        aria-label={t("createTagLabel")}
                        className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
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

        <a
          href={`/api/files/download?id=${id}`}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          {t("download")}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </a>
        <a
          href={webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {t("viewInItslearning")}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
