"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { PlansBrowser } from "@/components/PlansBrowser";
import { PageContainer } from "@/components/PageContainer";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PlansPage() {
  const t = useTranslations("Plans");

  const { data: files, error, isLoading } = useSWR("/api/files/all", fetcher);

  return (
    <PageContainer className="px-6 py-6 md:px-10 md:py-7 md:pb-10">
      <header className="mb-5">
        <h1 className="mb-1 text-xl font-bold text-text-primary md:text-[28px]">
          {t("title")}
        </h1>
        <p className="text-sm text-text-secondary">{t("subtitle")}</p>
      </header>

      {isLoading ? (
        <LoadingState label={t("loading")} />
      ) : error ? (
        <ErrorState message={t("loadFailed")} hint={t("loadFailedHint")} />
      ) : (
        <PlansBrowser files={files || []} cacheKey="/api/files/all" />
      )}
    </PageContainer>
  );
}
