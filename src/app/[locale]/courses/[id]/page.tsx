"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Navigation } from "@/components/Navigation";
import { Loader2, Megaphone } from "lucide-react";
import { use, useState, useEffect } from "react";
import dynamic from "next/dynamic";

const FileBrowser = dynamic(
  () => import("@/components/FileBrowser").then((mod) => mod.FileBrowser),
  {
    loading: () => (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
      </div>
    ),
    ssr: false,
  },
);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params); // Unwrap params in Client Component
  const {
    data: resources,
    error,
    isLoading,
  } = useSWR(`/api/courses/${id}/resources`, fetcher);

  const {
    data: bulletinsData,
    error: bulletinsError,
    isLoading: bulletinsLoading,
  } = useSWR(`/api/courses/${id}/bulletins`, fetcher);

  // Transform resources into FileBrowser props
  // Phase 1 Scraper returns: { ElementId, Title, ElementType, IconUrl, ContentUrl }
  // FileBrowser expects: { id, customName, webUrl, isExamRelevant... }
  // Live-scraped resources have no UserFile row → no flag persistence → omit all flag fields

  const files = Array.isArray(resources)
    ? resources.map((r: any) => ({
        id: r.ElementId,
        customName: r.Title,
        type: r.ElementType === "Folder" ? "folder" : "file",
        webUrl: r.ContentUrl || "#",
        uploadedAt: undefined,
        // isExamRelevant / isAP1 / isAP2 intentionally omitted — they are not
        // persisted for live-scraped resources and should not be shown.
      }))
    : [];

  const bulletins: any[] = Array.isArray(bulletinsData) ? bulletinsData : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Course Resources
          </h1>
          <Navigation />
        </header>

        {isLoading && <div className="text-gray-500">Loading resources...</div>}
        {error && <div className="text-red-500">Failed to load resources.</div>}

        {files.length > 0 && (
          <FileBrowser
            files={files}
            persistable={false}
          />
        )}
        {!isLoading && files.length === 0 && (
          <p className="text-gray-500">No resources found.</p>
        )}

        {/* Bulletins Section */}
        <section className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Course Bulletins
            </h2>
          </div>

          {bulletinsLoading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="animate-spin w-4 h-4" />
              Loading bulletins…
            </div>
          )}
          {bulletinsError && (
            <p className="text-red-500 text-sm">Failed to load bulletins.</p>
          )}

          {!bulletinsLoading && bulletins.length === 0 && !bulletinsError && (
            <p className="text-gray-500 text-sm italic">
              No bulletins for this course.
            </p>
          )}

          <div className="space-y-3">
            {bulletins.map((b: any, i: number) => (
              <div
                key={b.BulletinId ?? i}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {b.Title && (
                      <h3 className="font-medium text-gray-900 dark:text-white mb-1 truncate">
                        {b.Title}
                      </h3>
                    )}
                    {b.Text && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line line-clamp-4">
                        {b.Text}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
                    {b.PublishedDate && (
                      <div>
                        {new Date(b.PublishedDate).toLocaleDateString()}
                      </div>
                    )}
                    {b.AuthorFullName && <div>{b.AuthorFullName}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
