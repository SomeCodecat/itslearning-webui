"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Link } from "@/i18n/routing";
import { PageContainer } from "@/components/PageContainer";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Course = {
  CourseId: number | string;
  Title: string;
  Code?: string | null;
};

export default function CoursesPage() {
  const t = useTranslations("Courses");
  const {
    data: courses,
    error,
    isLoading,
  } = useSWR<Course[]>("/api/courses", fetcher);

  return (
    <PageContainer className="px-6 py-6 md:px-10 md:py-10">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-text-primary md:text-[28px]">
          {t("title")}
        </h1>
      </header>

      {isLoading && (
        <LoadingState label={t("loading")} />
      )}
      {error && (
        <ErrorState message={t("loadFailed")} />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.isArray(courses) &&
          courses.map((course) => (
            <Link
              key={course.CourseId}
              href={`/courses/${course.CourseId}`}
              className="block rounded-card border border-line bg-card p-5 transition-colors hover:border-line-strong"
            >
              <h3 className="mb-2 truncate text-[15px] font-semibold text-text-primary">
                {course.Title}
              </h3>
              <p className="truncate font-mono text-xs text-text-tertiary">
                {course.Code || t("noCode")}
              </p>
              <div className="mt-4 flex justify-end">
                <span className="text-xs font-semibold text-accent-text">
                  {t("viewResources")}
                </span>
              </div>
            </Link>
          ))}
        {!isLoading &&
          !error &&
          (!Array.isArray(courses) || courses.length === 0) && (
          <EmptyState icon={<BookOpen size={20} />} title={t("empty")} />
        )}
      </div>
    </PageContainer>
  );
}
