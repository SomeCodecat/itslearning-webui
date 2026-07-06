"use client";

import { useFormatter, useTranslations } from "next-intl";
import useSWR from "swr";
import { Loader2, Megaphone, ChevronDown, ChevronUp } from "lucide-react";
import { use, useState } from "react";
import dynamic from "next/dynamic";
import { PageContainer } from "@/components/PageContainer";
import { CourseNav } from "@/components/CourseNav";

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

type CourseResource = {
  ElementId: number;
  Title: string;
  ElementType?: string;
  ContentUrl?: string | null;
};

type CourseBulletin = {
  BulletinId?: number | string | null;
  Title?: string | null;
  Text?: string | null;
  PublishedDate?: string | null;
  AuthorFullName?: string | null;
};

export default function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params); // Unwrap params in Client Component
  const t = useTranslations("CourseDetail");
  const format = useFormatter();
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    data: resources,
    error,
    isLoading,
  } = useSWR<CourseResource[]>(`/api/courses/${id}/resources`, fetcher);

  const {
    data: bulletinsData,
    error: bulletinsError,
    isLoading: bulletinsLoading,
  } = useSWR<CourseBulletin[]>(`/api/courses/${id}/bulletins`, fetcher);

  // Transform resources into FileBrowser props
  // Phase 1 Scraper returns: { ElementId, Title, ElementType, IconUrl, ContentUrl }
  // FileBrowser expects: { id, customName, webUrl, isExamRelevant... }
  // Live-scraped resources have no UserFile row → no flag persistence → omit all flag fields

  const files = Array.isArray(resources)
    ? resources.map((r) => ({
        id: r.ElementId,
        customName: r.Title,
        type:
          r.ElementType === "Folder"
            ? t("resourceType.folder")
            : t("resourceType.file"),
        webUrl: r.ContentUrl || "#",
        uploadedAt: undefined,
        // isExamRelevant / isAP1 / isAP2 intentionally omitted — they are not
        // persisted for live-scraped resources and should not be shown.
      }))
    : [];

  const bulletins: CourseBulletin[] = Array.isArray(bulletinsData)
    ? bulletinsData
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("title")}
          </h1>
        </header>
        <CourseNav courseId={id} />

        <div className="flex flex-col lg:flex-row gap-6 mt-6 items-start">
          {/* Main Column: Resources */}
          <div className="flex-1 w-full order-2 lg:order-1">
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="animate-spin w-5 h-5 text-blue-500" />
                {t("loadingResources")}
              </div>
            )}
            {error && (
              <div className="text-red-500 dark:text-red-400">
                {t("resourcesFailed")}
              </div>
            )}

            {files.length > 0 && (
              <FileBrowser files={files} persistable={false} />
            )}
            {!isLoading && files.length === 0 && (
              <p className="text-gray-500">{t("noResources")}</p>
            )}
          </div>

          {/* Sidebar: Bulletins */}
          <aside className="w-full lg:w-80 xl:w-96 shrink-0 order-1 lg:order-2 lg:sticky lg:top-6 bg-white dark:bg-gray-800 lg:bg-transparent lg:dark:bg-transparent border border-gray-200 dark:border-gray-700 lg:border-0 rounded-xl p-4 lg:p-0 shadow-sm lg:shadow-none lg:max-h-[calc(100vh-6rem)] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-controls="bulletins-content"
              className="w-full flex items-center justify-between text-left lg:pointer-events-none lg:cursor-default"
            >
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-500 shrink-0" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  {t("bulletins")}
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                    {bulletins.length}
                  </span>
                </h2>
              </div>
              <div className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </button>

            <div
              id="bulletins-content"
              className={`mt-4 lg:mt-6 space-y-3 lg:block ${isExpanded ? "block" : "hidden"}`}
            >
              {bulletinsLoading && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="animate-spin w-4 h-4" />
                  {t("loadingBulletins")}
                </div>
              )}
              {bulletinsError && (
                <p className="text-red-500 dark:text-red-400 text-sm">
                  {t("bulletinsFailed")}
                </p>
              )}

              {!bulletinsLoading && bulletins.length === 0 && !bulletinsError && (
                <p className="text-gray-500 text-sm italic">
                  {t("noBulletins")}
                </p>
              )}

              <div className="space-y-3">
                {bulletins.map((b, i) => (
                  <div
                    key={b.BulletinId ?? i}
                    className="bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-100 dark:border-gray-800 p-4 shadow-sm"
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
                            {format.dateTime(new Date(b.PublishedDate), {
                              dateStyle: "medium",
                            })}
                          </div>
                        )}
                        {b.AuthorFullName && <div>{b.AuthorFullName}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
