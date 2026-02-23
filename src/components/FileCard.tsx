import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "./Badge";

interface FileCardProps {
  id: number;
  fileName: string;
  webUrl: string;
  isExamRelevant?: boolean;
  isAP1?: boolean;
  isAP2?: boolean;
  fileSize?: string;
  date?: string;
}

export function FileCard({
  id,
  fileName,
  webUrl,
  isExamRelevant,
  isAP1,
  isAP2,
  fileSize,
  date,
}: FileCardProps) {
  const t = useTranslations("FileBrowser");

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
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
        <div>
          <h3
            className="font-medium text-gray-900 dark:text-white truncate max-w-md"
            title={fileName}
          >
            {fileName}
          </h3>
          <div className="flex gap-2 mt-1">
            {isAP1 && <Badge label={t("ap1")} color="blue" />}
            {isAP2 && <Badge label={t("ap2")} color="blue" />}
            {isExamRelevant && <Badge label={t("examRelevant")} color="red" />}
          </div>
          {date && (
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
              {date}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href={`/api/files/download?id=${id}`}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          {t("download") || "Download"}
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
