"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { FileBrowser } from "@/components/FileBrowser";
import { PageContainer } from "@/components/PageContainer";
import { FileText } from "lucide-react";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function FilesPage() {
  const t = useTranslations("Files");

  const { data: files, error, isLoading } = useSWR("/api/files/all", fetcher);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-4 py-4 md:px-10 md:py-7 md:pb-10">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent-text" />
              <h1 className="text-xl font-bold text-text-primary md:text-[28px]">
              {t("title")}
            </h1>
          </div>
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
