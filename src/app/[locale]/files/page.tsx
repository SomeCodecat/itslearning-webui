"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { FileBrowser } from "@/components/FileBrowser";
import { PageContainer } from "@/components/PageContainer";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function FilesPage() {
  const t = useTranslations("Files");

  const { data: files, error, isLoading } = useSWR("/api/files/all", fetcher);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-6 py-6 md:px-10 md:py-7 md:pb-10">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
          <div>
            <h1 className="mb-1 text-xl font-bold text-text-primary md:text-[28px]">
              {t("title")}
            </h1>
            <p className="text-sm text-text-secondary">
              {t("subtitle")}
            </p>
          </div>
        </header>

        {isLoading ? (
          <LoadingState label={t("loading")} />
        ) : error ? (
          <ErrorState message={t("loadFailed")} hint={t("loadFailedHint")} />
        ) : (
          <FileBrowser files={files || []} cacheKey="/api/files/all" allowCourseGrouping />
        )}
      </PageContainer>
    </div>
  );
}
