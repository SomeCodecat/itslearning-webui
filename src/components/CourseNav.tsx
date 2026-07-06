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
      <div className="mb-2 flex items-center gap-2 text-[13px] text-text-tertiary md:mb-2.5">
        <Link
          href="/courses"
          className="transition-colors hover:text-accent-text"
        >
          {t("allCourses")}
        </Link>
        <span>/</span>
        <span className="max-w-[200px] truncate font-medium text-text-primary md:max-w-xs">
          {courseTitle || (
            <span className="inline-block h-4 w-24 animate-pulse rounded bg-elevated align-middle"></span>
          )}
        </span>
      </div>

      {/* Course Title */}
      <h1 className="mb-5 text-xl font-bold leading-tight text-text-primary md:text-[28px] md:tracking-normal">
        {courseTitle || (
          <span className="inline-block h-8 w-48 animate-pulse rounded bg-elevated"></span>
        )}
      </h1>

      {/* Tab bar */}
      <div className="mb-6 border-b border-line">
        <nav
          className="-mb-px flex gap-[18px] overflow-x-auto md:gap-[26px]"
          aria-label="Course navigation"
        >
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
                className={`whitespace-nowrap border-b-2 pb-2.5 text-sm transition-colors md:pb-3 ${
                  isActive
                    ? "border-accent text-accent-text font-semibold"
                    : "border-transparent text-text-secondary hover:text-text-primary font-medium"
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
