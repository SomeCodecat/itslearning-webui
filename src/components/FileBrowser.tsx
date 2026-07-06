"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { FileCard } from "./FileCard";
import { Filter, Search, ArrowUpDown, Loader2 } from "lucide-react";

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
  persistable = true,
  onFileFlagsChange,
}: FileBrowserProps) {
  const t = useTranslations("FileBrowser");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"All" | "AP1" | "AP2" | "Exam">(
    "All",
  );
  const [filterTagId, setFilterTagId] = useState<number | null>(null);
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "name_asc">(
    "date_desc",
  );

  // Full-text search state
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setSearchLoading(true);
    setSearchError(false);
    try {
      const res = await fetch(
        `/api/files/search?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) {
        setSearchResults([]);
        setSearchError(true);
      } else {
        setSearchResults(await res.json());
      }
    } catch {
      setSearchResults([]);
      setSearchError(true);
    } finally {
      setSearchLoading(false);
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

  const merged =
    search.length >= 2 ? mergeDedup(nameFiltered, searchResults) : nameFiltered;

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
            placeholder="Search files…"
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
              {ft}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <select
            id="tag-filter-select"
            className="px-2 py-2 border border-border rounded-md text-sm bg-background"
            value={filterTagId ?? ""}
            onChange={(e) =>
              setFilterTagId(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">All tags</option>
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
            className="px-2 py-2 border border-border rounded-md text-sm bg-background"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="name_asc">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Content search indicator */}
      {search.length >= 2 && !searchLoading && searchResults.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
          {searchResults.filter((r) => r.contentMatch).length > 0 &&
            `${searchResults.filter((r) => r.contentMatch).length} result(s) matched in file content.`}
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
            fileName={file.customName || "Unnamed File"}
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
                ? new Date(file.uploadedAt).toLocaleDateString()
                : undefined
            }
            tags={file.tags ?? []}
            persistable={persistable}
            contentMatch={file.contentMatch ?? false}
            onFlagsChange={(updated) => onFileFlagsChange?.(file.id, updated)}
            onTagsChange={(updatedTags) => {
              // no-op here: FileBrowser could mutate SWR cache if needed
              // but for simplicity FileCard manages its own tag state
            }}
          />
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
            No files match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
