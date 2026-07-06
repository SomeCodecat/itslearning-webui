"use client";

import { useFormatter, useTranslations } from "next-intl";
import useSWR from "swr";
import { ChevronDown, ChevronUp, FolderOpen, Megaphone } from "lucide-react";
import { use, useState } from "react";
import dynamic from "next/dynamic";
import { PageContainer } from "@/components/PageContainer";
import { CourseNav } from "@/components/CourseNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";

const FileBrowser = dynamic(
  () => import("@/components/FileBrowser").then((mod) => mod.FileBrowser),
  {
    loading: () => <LoadingState label="" />,
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
  const [expandedBulletins, setExpandedBulletins] = useState<Set<string>>(
    new Set(),
  );

  const toggleBulletin = (key: string) => {
    setExpandedBulletins((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
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
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-4 py-4 md:px-10 md:py-7 md:pb-10">
        <CourseNav courseId={id} />

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.7fr_1fr]">
          {/* Main Column: Resources */}
          <section className="min-w-0">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <h2 className="text-card-title text-text-primary">
                {t("title")}
              </h2>
            </div>
            {isLoading && (
              <LoadingState label={t("loadingResources")} />
            )}
            {error && (
              <ErrorState message={t("resourcesFailed")} />
            )}

            {files.length > 0 && (
              <FileBrowser files={files} persistable={false} />
            )}
            {!isLoading && files.length === 0 && (
              <EmptyState icon={<FolderOpen size={20} />} title={t("noResources")} />
            )}
          </section>

          {/* Sidebar: Bulletins */}
          <aside className="w-full min-w-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-controls="bulletins-content"
              className="mb-3.5 flex w-full items-center justify-between text-left lg:pointer-events-none lg:cursor-default"
            >
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 shrink-0 text-accent-text" />
                <h2 className="flex items-center gap-2 text-card-title text-text-primary">
                  {t("bulletins")}
                  <span className="rounded-full bg-accent-subtle px-2 py-0.5 font-mono text-xs font-semibold text-accent-text">
                    {bulletins.length}
                  </span>
                </h2>
              </div>
              <div className="rounded-control p-1 text-text-tertiary transition-colors hover:bg-elevated lg:hidden">
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            </button>

            <div
              id="bulletins-content"
              className={`space-y-3 lg:block ${isExpanded ? "block" : "hidden"}`}
            >
              {bulletinsLoading && (
                <LoadingState label={t("loadingBulletins")} />
              )}
              {bulletinsError && (
                <ErrorState message={t("bulletinsFailed")} />
              )}

              {!bulletinsLoading && bulletins.length === 0 && !bulletinsError && (
                <EmptyState icon={<Megaphone size={20} />} title={t("noBulletins")} />
              )}

              <div className="space-y-3">
                {bulletins.map((b, i) => {
                  const bulletinKey = String(b.BulletinId ?? i);
                  const isBulletinExpanded = expandedBulletins.has(bulletinKey);
                  // Only offer the toggle when the text is likely clamped.
                  const isTogglable =
                    !!b.Text &&
                    (b.Text.length > 240 || b.Text.split("\n").length > 4);

                  return (
                  <div
                    key={bulletinKey}
                    className="rounded-card border border-line bg-card px-4 py-[18px]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {b.Title && (
                          <h3
                            className={`mb-1 text-sm font-semibold text-text-primary ${isBulletinExpanded ? "" : "truncate"}`}
                          >
                            {b.Title}
                          </h3>
                        )}
                        {b.Text && (
                          <p
                            className={`whitespace-pre-line text-[13px] leading-[1.55] text-text-secondary ${isBulletinExpanded ? "" : "line-clamp-4"}`}
                          >
                            {b.Text}
                          </p>
                        )}
                        {isTogglable && (
                          <button
                            type="button"
                            onClick={() => toggleBulletin(bulletinKey)}
                            aria-expanded={isBulletinExpanded}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-text transition-colors hover:text-text-primary"
                          >
                            {isBulletinExpanded ? (
                              <>
                                {t("showLess")}
                                <ChevronUp className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                {t("showMore")}
                                <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="shrink-0 space-y-0.5 text-right font-mono text-[11px] text-text-tertiary">
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
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
