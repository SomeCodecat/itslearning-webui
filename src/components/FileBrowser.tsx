import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { FileCard } from "./FileCard";
import { Filter, Search, ArrowUpDown } from "lucide-react";

interface FileBrowserProps {
  files: any[]; // Replace with proper type from Prisma/API
}

export function FileBrowser({ files }: FileBrowserProps) {
  const t = useTranslations("FileBrowser");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"All" | "AP1" | "AP2" | "Exam">(
    "All",
  );
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "name_asc">(
    "date_desc",
  );

  // Filtering
  const filtered = files.filter((f) => {
    const matchesSearch = f.customName
      ?.toLowerCase()
      .includes(search.toLowerCase());

    let matchesType = true;
    if (filterType === "AP1") matchesType = !!f.isAP1;
    if (filterType === "AP2") matchesType = !!f.isAP2;
    if (filterType === "Exam") matchesType = !!f.isExamRelevant;

    return matchesSearch && matchesType;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name_asc") {
      return (a.customName || "").localeCompare(b.customName || "");
    }

    // Date sorting
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
            type="text"
            placeholder="Search files..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Toggles */}
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-md">
          {(["All", "Exam", "AP1", "AP2"] as const).map((ft) => (
            <button
              key={ft}
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
            date={
              file.uploadedAt
                ? new Date(file.uploadedAt).toLocaleDateString()
                : undefined
            }
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
