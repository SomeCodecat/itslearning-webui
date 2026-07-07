"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { use } from "react";
import { FileBrowser } from "@/components/FileBrowser";
import { PageContainer } from "@/components/PageContainer";
import { CourseNav } from "@/components/CourseNav";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CourseFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("Files");
  const tCourse = useTranslations("CourseDetail");

  const cacheKey = `/api/files/all?courseId=${id}`;
  const { data: files, error, isLoading } = useSWR(cacheKey, fetcher);

  return (
    <PageContainer className="px-6 py-6 md:px-10 md:py-7 md:pb-10">
        <CourseNav courseId={id} />

        <h2 className="mb-4 text-card-title text-text-primary">
          {tCourse("files")}
        </h2>

        {isLoading ? (
          <LoadingState label={t("loading")} />
        ) : error ? (
          <ErrorState message={t("loadFailed")} hint={t("loadFailedHint")} />
        ) : (
          <FileBrowser files={files || []} cacheKey={cacheKey} />
        )}
      </PageContainer>
  );
}
