"use client";

import useSWR from "swr";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";

interface Course {
  CourseId: number;
  Title: string;
  Code?: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function CourseNav({ courseId }: { courseId: string }) {
  const t = useTranslations("CourseDetail");
  const pathname = usePathname();
  const { data: courses } = useSWR<Course[]>("/api/courses", fetcher);

  const course = courses?.find((c) => c.CourseId === Number(courseId));
  const courseTitle = course?.Title || "";

  const tabs = [
    { segment: "", label: t("overview") },
    { segment: "/files", label: t("files") },
    { segment: "/tasks", label: t("tasks") },
    { segment: "/grades", label: t("grades") },
  ];

  return (
    <div className="mb-6">
      {/* Breadcrumb line */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
        <Link
          href="/courses"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {t("allCourses")}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px] md:max-w-xs">
          {courseTitle || (
            <span className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded inline-block align-middle"></span>
          )}
        </span>
      </div>

      {/* Course Title */}
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
        {courseTitle || (
          <span className="h-8 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded inline-block"></span>
        )}
      </h1>

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-6 -mb-px" aria-label="Course navigation">
          {tabs.map((tab) => {
            const targetPath =
              tab.segment === ""
                ? `/courses/${courseId}`
                : `/courses/${courseId}${tab.segment}`;
            // Exact match: Overview is active only on the main page.
            // Other pages match their specific suffix.
            const isActive = pathname === targetPath;

            return (
              <Link
                key={tab.segment}
                href={targetPath}
                aria-current={isActive ? "page" : undefined}
                className={`text-sm font-medium transition-colors pb-3 border-b-2 -mb-px ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-bold border-blue-600 dark:border-blue-400"
                    : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 border-transparent"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
