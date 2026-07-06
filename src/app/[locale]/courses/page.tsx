"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Link } from "@/i18n/routing";
import { PageContainer } from "@/components/PageContainer";
import { Loader2 } from "lucide-react";

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("title")}
          </h1>
        </header>

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="animate-spin w-5 h-5 text-blue-500" />
            {t("loading")}
          </div>
        )}
        {error && (
          <div className="text-red-500 dark:text-red-400">
            {t("loadFailed")}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(courses) &&
            courses.map((course) => (
              <Link
                key={course.CourseId}
                href={`/courses/${course.CourseId}`}
                className="block bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                  {course.Title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {course.Code || t("noCode")}
                </p>
                <div className="mt-4 flex justify-end">
                  <span className="text-blue-600 text-sm font-medium">
                    {t("viewResources")} &rarr;
                  </span>
                </div>
              </Link>
            ))}
          {!isLoading &&
            !error &&
            (!Array.isArray(courses) || courses.length === 0) && (
            <div className="text-gray-500">{t("empty")}</div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
