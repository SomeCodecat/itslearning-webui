"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { FileBrowser } from "@/components/FileBrowser";
import { PageContainer } from "@/components/PageContainer";
import { Loader2, FileText } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function FilesPage() {
  const t = useTranslations("Files");

  const { data: files, error, isLoading } = useSWR("/api/files/all", fetcher);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <FileText size={24} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("title")}
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin w-10 h-10 text-blue-500 mb-4" />
            <p className="text-gray-500">{t("loading")}</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800/30">
            <p className="font-semibold">{t("loadFailed")}</p>
            <p className="text-sm">{t("loadFailedHint")}</p>
          </div>
        ) : (
          <FileBrowser files={files || []} cacheKey="/api/files/all" />
        )}
      </PageContainer>
    </div>
  );
}
