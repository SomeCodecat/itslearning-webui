"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useSWRConfig } from "swr";
import { FileCard } from "./FileCard";
import { Search, ArrowUpDown, Loader2, Download } from "lucide-react";

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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <input
            id="file-search-input"
            type="text"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {searchLoading && (
            <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 animate-spin" />
          )}
        </div>

        {/* Filter Toggles */}
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-md">
          {(["All", "Exam", "AP1", "AP2"] as const).map((ft) => (
            <button
              key={ft}
              id={`filter-btn-${ft}`}
              onClick={() => setFilterType(ft)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filterType === ft
                  ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              }`}
            >
              {filterLabels[ft]}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <select
            id="tag-filter-select"
            aria-label={t("filterTagLabel")}
            className="px-2 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md text-sm"
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
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-gray-400" />
          <select
            aria-label={t("sortLabel")}
            className="px-2 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md text-sm"
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
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        <p className="text-xs text-red-500 dark:text-red-400 px-1" role="alert">
          {t("zipError")}
        </p>
      )}
      {zipSkipped > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
          {t("zipSkipped", { count: zipSkipped })}
        </p>
      )}

      {/* Content search indicator */}
      {search.length >= 2 && !searchLoading && searchError && (
        <p className="text-xs text-red-500 dark:text-red-400 px-1">
          {t("searchError")}
        </p>
      )}
      {search.length >= 2 && !searchLoading && contentMatchCount > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
          {t("contentMatches", { count: contentMatchCount })}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-2">
        {" "}
        {/* Keeping list view style for now, or could be grid-cols-2 lg:grid-cols-3 */}
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
        {sorted.length === 0 && (
          <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
            {t("noMatches")}
          </div>
        )}
      </div>
    </div>
  );
}
