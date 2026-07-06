"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useSWRConfig } from "swr";
import { FileCard } from "./FileCard";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  FileX,
  Loader2,
  Search,
} from "lucide-react";
import { groupFiles } from "@/lib/groupFiles";
import { EmptyState } from "./ui/EmptyState";

interface TagItem {
  id: number;
  name: string;
}

interface FileItem {
  id: number;
  customName: string;
  isExamRelevant?: boolean;
  isAP1?: boolean;
  isAP2?: boolean;
  uploadedAt?: string;
  size?: string | null;
  courseTitle?: string;
  type?: string | null;
  webUrl?: string;
  tags?: TagItem[];
  contentMatch?: boolean;
  folderPath?: string | null;
  topic?: string | null;
  planTitle?: string | null;
}

interface FileBrowserProps {
  files: FileItem[];
  /** SWR cache key used by the parent (e.g. "/api/files/all"). After a flag or
   * tag change the browser calls mutate(cacheKey) so the parent cache reflects
   * the new state without a full page reload. */
  cacheKey?: string;
  /** When false, all FileCards are rendered without the flag toggle (e.g. live-scraped course resources) */
  persistable?: boolean;
  /** Optional callback fired after a flag is toggled, allowing the parent to mutate SWR cache */
  onFileFlagsChange?: (
    fileId: number,
    updated: { isExamRelevant: boolean; isAP1: boolean; isAP2: boolean },
  ) => void;
  allowCourseGrouping?: boolean;
}

/** Merge two file arrays by id, preferring the second array's entries */
function mergeDedup(base: FileItem[], extra: FileItem[]): FileItem[] {
  const map = new Map<number, FileItem>();
  for (const f of base) map.set(f.id, f);
  for (const f of extra) map.set(f.id, f); // extra (content matches) overwrite
  return Array.from(map.values());
}

export function FileBrowser({
  files,
  cacheKey,
  persistable = true,
  onFileFlagsChange,
  allowCourseGrouping = false,
}: FileBrowserProps) {
  const t = useTranslations("FileBrowser");
  const format = useFormatter();
  const { mutate } = useSWRConfig();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"All" | "AP1" | "AP2" | "Exam">(
    "All",
  );
  const [filterTagId, setFilterTagId] = useState<number | null>(null);
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "name_asc">(
    "date_desc",
  );

  // ZIP download state
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState(false);
  const [zipSkipped, setZipSkipped] = useState(0);

  // Full-text search state
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const [groupingMode, setGroupingMode] = useState<"flat" | "topic" | "course">("flat");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const storageKey = allowCourseGrouping
    ? "itslearning-file-grouping-global"
    : "itslearning-file-grouping-course";

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof localStorage !== "undefined" &&
      typeof localStorage.getItem === "function"
    ) {
      const stored = localStorage.getItem(storageKey);
      if (
        stored === "flat" ||
        stored === "topic" ||
        (stored === "course" && allowCourseGrouping)
      ) {
        setGroupingMode(stored as "flat" | "topic" | "course");
      }
    }
  }, [storageKey, allowCourseGrouping]);

  const handleGroupingChange = (mode: "flat" | "topic" | "course") => {
    setGroupingMode(mode);
    if (
      typeof window !== "undefined" &&
      typeof localStorage !== "undefined" &&
      typeof localStorage.setItem === "function"
    ) {
      localStorage.setItem(storageKey, mode);
    }
  };

  const hasGroupingData = React.useMemo(() => {
    return files.some(
      (f) =>
        !!f.topic ||
        !!f.planTitle ||
        !!f.folderPath ||
        !!f.courseTitle
    );
  }, [files]);

  const showGroupingToggle = hasGroupingData && cacheKey !== "/api/files/recent";

  const handleFlagsChange = useCallback(
    (fileId: number, updatedFlags: { isExamRelevant: boolean; isAP1: boolean; isAP2: boolean }) => {
      onFileFlagsChange?.(fileId, updatedFlags);
      if (cacheKey) {
        mutate(
          cacheKey,
          (currentData: FileItem[] | undefined) => {
            if (!currentData) return currentData;
            return currentData.map((f) =>
              f.id === fileId ? { ...f, ...updatedFlags } : f
            );
          },
          { revalidate: false }
        );
      }
    },
    [cacheKey, onFileFlagsChange, mutate]
  );

  const handleTagsChange = useCallback(
    (fileId: number, updatedTags: TagItem[]) => {
      if (cacheKey) {
        mutate(
          cacheKey,
          (currentData: FileItem[] | undefined) => {
            if (!currentData) return currentData;
            return currentData.map((f) =>
              f.id === fileId ? { ...f, tags: updatedTags } : f
            );
          },
          { revalidate: false }
        );
      }
    },
    [cacheKey, mutate]
  );

  // Collect all unique tags from the files list for the tag filter dropdown
  const allTags: TagItem[] = React.useMemo(() => {
    const map = new Map<number, TagItem>();
    for (const f of files) {
      for (const tag of f.tags ?? []) {
        map.set(tag.id, tag);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [files]);

  // Debounced content search
  const runContentSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSearchLoading(true);
    setSearchError(false);
    try {
      const res = await fetch(
        `/api/files/search?q=${encodeURIComponent(q)}`,
        { signal: controller.signal }
      );
      if (!res.ok) {
        setSearchResults([]);
        setSearchError(true);
      } else {
        setSearchResults(await res.json());
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setSearchResults([]);
      setSearchError(true);
    } finally {
      if (abortControllerRef.current === controller) {
        setSearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      runContentSearch(search);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, runContentSearch]);

  // Build the displayed list:
  // - Name-filter from prop files
  // - Merged with content-matched results from the search endpoint
  const nameFiltered = files.filter((f) =>
    (f.customName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const allowedFileIds = React.useMemo(() => new Set(files.map((f) => f.id)), [files]);
  const filteredSearchResults = React.useMemo(() => {
    return searchResults.filter((r) => allowedFileIds.has(r.id));
  }, [searchResults, allowedFileIds]);

  const merged =
    search.length >= 2 ? mergeDedup(nameFiltered, filteredSearchResults) : nameFiltered;

  // Apply IHK filter
  const filtered = merged.filter((f) => {
    let matchesType = true;
    if (filterType === "AP1") matchesType = !!f.isAP1;
    if (filterType === "AP2") matchesType = !!f.isAP2;
    if (filterType === "Exam") matchesType = !!f.isExamRelevant;

    const matchesTag =
      filterTagId === null ||
      (f.tags ?? []).some((tag) => tag.id === filterTagId);

    return matchesType && matchesTag;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name_asc") {
      return (a.customName || "").localeCompare(b.customName || "");
    }
    const dateA = new Date(a.uploadedAt || 0).getTime();
    const dateB = new Date(b.uploadedAt || 0).getTime();
    return sort === "date_asc" ? dateA - dateB : dateB - dateA;
  });

  const groups = React.useMemo(() => {
    return groupFiles(sorted, groupingMode, t("ungrouped"));
  }, [sorted, groupingMode, t]);

  const contentMatchCount = searchResults.filter((r) => r.contentMatch).length;

  async function handleZipDownload() {
    if (zipLoading || sorted.length === 0) return;
    setZipLoading(true);
    setZipError(false);
    setZipSkipped(0);
    try {
      const res = await fetch("/api/files/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: sorted.map((f) => f.id) }),
      });
      if (!res.ok) {
        setZipError(true);
        return;
      }
      const skipped = Number(res.headers.get("X-Skipped-Files") ?? 0);
      if (skipped > 0) setZipSkipped(skipped);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `files-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setZipError(true);
    } finally {
      setZipLoading(false);
    }
  }
  const filterLabels = {
    All: t("filterAll"),
    Exam: t("filterExam"),
    AP1: t("ap1"),
    AP2: t("ap2"),
  };

  return (
    <div className="space-y-[18px]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[260px] flex-1 max-md:min-w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            id="file-search-input"
            type="text"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            className="w-full rounded-control border border-line-strong bg-elevated py-[9px] pl-9 pr-9 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searchLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-tertiary" />
          )}
        </div>

        {/* Filter Toggles */}
        <div className="flex gap-1.5 overflow-x-auto max-md:w-full">
          {(["All", "Exam", "AP1", "AP2"] as const).map((ft) => (
            <button
              key={ft}
              id={`filter-btn-${ft}`}
              onClick={() => setFilterType(ft)}
              className={`whitespace-nowrap rounded-control border px-3 py-2 text-xs font-semibold transition-colors max-md:py-1.5 ${
                filterType === ft
                  ? "border-accent bg-accent-subtle text-accent-text"
                  : "border-line-strong bg-elevated text-text-secondary hover:bg-elevated-strong"
              }`}
            >
              {filterLabels[ft]}
            </button>
          ))}
        </div>

        {/* Grouping Toggle */}
        {showGroupingToggle && (
          <div className="flex gap-1.5 overflow-x-auto max-md:w-full" aria-label={t("groupingLabel")}>
            <button
              id="group-flat-btn"
              type="button"
              onClick={() => handleGroupingChange("flat")}
              className={`whitespace-nowrap rounded-control border px-3 py-2 text-xs font-semibold transition-colors max-md:py-1.5 ${
                groupingMode === "flat"
                  ? "border-accent bg-accent-subtle text-accent-text"
                  : "border-line-strong bg-elevated text-text-secondary hover:bg-elevated-strong"
              }`}
            >
              {t("groupingFlat")}
            </button>
            <button
              id="group-topic-btn"
              type="button"
              onClick={() => handleGroupingChange("topic")}
              className={`whitespace-nowrap rounded-control border px-3 py-2 text-xs font-semibold transition-colors max-md:py-1.5 ${
                groupingMode === "topic"
                  ? "border-accent bg-accent-subtle text-accent-text"
                  : "border-line-strong bg-elevated text-text-secondary hover:bg-elevated-strong"
              }`}
            >
              {t("groupingTopic")}
            </button>
            {allowCourseGrouping && (
              <button
                id="group-course-btn"
                type="button"
                onClick={() => handleGroupingChange("course")}
                className={`whitespace-nowrap rounded-control border px-3 py-2 text-xs font-semibold transition-colors max-md:py-1.5 ${
                  groupingMode === "course"
                    ? "border-accent bg-accent-subtle text-accent-text"
                    : "border-line-strong bg-elevated text-text-secondary hover:bg-elevated-strong"
                }`}
              >
                {t("groupingCourse")}
              </button>
            )}
          </div>
        )}

        {/* Tag filter */}
        {allTags.length > 0 && (
          <select
            id="tag-filter-select"
            aria-label={t("filterTagLabel")}
            className="w-[130px] rounded-control border border-line-strong bg-elevated px-3 py-2 text-xs font-semibold text-text-secondary outline-none focus:border-accent max-md:hidden"
            value={filterTagId ?? ""}
            onChange={(e) =>
              setFilterTagId(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">{t("allTags")}</option>
            {allTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        )}

        {/* Sort */}
        <div className="flex items-center gap-2 max-md:hidden">
          <ArrowUpDown className="h-4 w-4 text-text-tertiary" />
          <select
            aria-label={t("sortLabel")}
            className="w-[130px] rounded-control border border-line-strong bg-elevated px-3 py-2 text-xs font-semibold text-text-secondary outline-none focus:border-accent"
            value={sort}
            onChange={(e) =>
              setSort(e.target.value as "date_desc" | "date_asc" | "name_asc")
            }
          >
            <option value="date_desc">{t("sortNewestFirst")}</option>
            <option value="date_asc">{t("sortOldestFirst")}</option>
            <option value="name_asc">{t("sortNameAsc")}</option>
          </select>
        </div>

        {/* ZIP download of the currently displayed files */}
        <button
          onClick={handleZipDownload}
          disabled={zipLoading || sorted.length === 0}
          aria-label={t("downloadZipAriaLabel")}
          className="flex items-center gap-2 rounded-control border border-line-strong bg-elevated px-3.5 py-[9px] text-sm font-semibold text-text-secondary transition-colors hover:bg-elevated-strong disabled:cursor-not-allowed disabled:opacity-50 max-md:hidden"
        >
          {zipLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{t("downloadZip")}</span>
        </button>
      </div>

      {/* ZIP download feedback */}
      {zipError && (
        <p className="px-1 text-xs text-error" role="alert">
          {t("zipError")}
        </p>
      )}
      {zipSkipped > 0 && (
        <p className="px-1 text-xs text-text-secondary">
          {t("zipSkipped", { count: zipSkipped })}
        </p>
      )}

      {/* Content search indicator */}
      {search.length >= 2 && !searchLoading && searchError && (
        <p className="px-1 text-xs text-error">
          {t("searchError")}
        </p>
      )}
      {search.length >= 2 && !searchLoading && contentMatchCount > 0 && (
        <p className="flex items-center gap-2 px-1 text-xs font-medium text-warning">
          <Search className="h-3.5 w-3.5" />
          {t("contentMatches", { count: contentMatchCount })}
        </p>
      )}

      {/* Grid / Groups */}
      <div className="space-y-4">
        {groupingMode === "flat" ? (
          <div className="flex flex-col gap-3 max-md:gap-2.5">
            {sorted.map((file) => (
              <FileCard
                key={file.id}
                id={file.id}
                fileName={file.customName || t("unnamedFile")}
                webUrl={file.webUrl || "#"}
                isExamRelevant={file.isExamRelevant}
                isAP1={file.isAP1}
                isAP2={file.isAP2}
                fileSize={
                  file.size != null && !isNaN(Number(file.size))
                    ? String(file.size)
                    : undefined
                }
                courseTitle={file.courseTitle ?? undefined}
                fileType={file.type ?? undefined}
                date={
                  file.uploadedAt
                    ? format.dateTime(new Date(file.uploadedAt), { dateStyle: "medium" })
                    : undefined
                }
                tags={file.tags ?? []}
                persistable={persistable}
                contentMatch={file.contentMatch ?? false}
                onFlagsChange={(updated) => {
                  handleFlagsChange(file.id, updated);
                }}
                onTagsChange={(updatedTags) => {
                  handleTagsChange(file.id, updatedTags);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const isCollapsed = !!collapsedGroups[group.key];
              const contentId = `group-content-${group.key}`;
              return (
                <div key={group.key} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }));
                    }}
                    aria-expanded={!isCollapsed}
                    aria-controls={contentId}
                    className="flex w-full cursor-pointer items-center justify-between rounded-control border border-line bg-card p-3 text-left text-sm font-medium text-text-secondary transition-colors hover:border-line-strong"
                  >
                    <span className="flex items-center gap-2">
                      {group.label}
                      <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-xs font-semibold text-text-tertiary">
                        {group.files.length}
                      </span>
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="h-4 w-4 text-text-tertiary" />
                    ) : (
                      <ChevronUp className="h-4 w-4 text-text-tertiary" />
                    )}
                  </button>

                  <div
                    id={contentId}
                    className={`${isCollapsed ? "hidden" : "flex"} flex-col gap-3 border-l border-line pl-2`}
                  >
                    {group.files.map((file) => (
                      <FileCard
                        key={file.id}
                        id={file.id}
                        fileName={file.customName || t("unnamedFile")}
                        webUrl={file.webUrl || "#"}
                        isExamRelevant={file.isExamRelevant}
                        isAP1={file.isAP1}
                        isAP2={file.isAP2}
                        fileSize={
                          file.size != null && !isNaN(Number(file.size))
                            ? String(file.size)
                            : undefined
                        }
                        courseTitle={file.courseTitle ?? undefined}
                        fileType={file.type ?? undefined}
                        date={
                          file.uploadedAt
                            ? format.dateTime(new Date(file.uploadedAt), { dateStyle: "medium" })
                            : undefined
                        }
                        tags={file.tags ?? []}
                        persistable={persistable}
                        contentMatch={file.contentMatch ?? false}
                        onFlagsChange={(updated) => {
                          handleFlagsChange(file.id, updated);
                        }}
                        onTagsChange={(updatedTags) => {
                          handleTagsChange(file.id, updatedTags);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {sorted.length === 0 && (
          <EmptyState icon={<FileX size={20} />} title={t("noMatches")} />
        )}
      </div>
    </div>
  );
}
