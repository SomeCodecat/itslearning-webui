"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import useSWR from "swr"; // Fetching data
import { FileBrowser } from "@/components/FileBrowser";
import { PageContainer } from "@/components/PageContainer";
import { Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type DashboardTask = {
  TaskId: number | string;
  Title: string;
  CourseTitle?: string;
  Deadline?: string | null;
};

export default function DashboardPage() {
  const indexT = useTranslations("Index");
  const t = useTranslations("Dashboard");
  const format = useFormatter();

  // 1. Fetch Tasks (Deadlines)
  const {
    data: tasks,
    error: tasksError,
    isLoading: tasksLoading,
  } = useSWR<DashboardTask[]>("/api/tasks?status=Active", fetcher);

  // 2. Fetch Recent Files (from DB)
  const {
    data: recentFiles,
    error: filesError,
    isLoading: filesLoading,
  } = useSWR("/api/files/recent", fetcher);

  // Filter tasks for upcoming deadlines (optional, API already does Active)
  // We can take top 5
  const upcomingDeadlines = Array.isArray(tasks) ? tasks.slice(0, 5) : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {indexT("title")}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                {indexT("welcome")}
              </p>
            </div>
          </div>
        </header>

        {/* Dashboard Widgets */}
        <div className="mb-8">
          {/* Widget 1: Upcoming Deadlines */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {t("upcomingDeadlines")}
            </h3>
            {tasksLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="animate-spin text-blue-500" />
              </div>
            ) : tasksError ? (
              <p className="text-red-500 text-sm">
                {t("failedDeadlines")}
              </p>
            ) : upcomingDeadlines.length === 0 ? (
              <p className="text-gray-500 text-sm">
                {t("noActiveDeadlines")}
              </p>
            ) : (
              <ul className="space-y-3">
                {upcomingDeadlines.map((task) => (
                  <li
                    key={task.TaskId}
                    className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0"
                  >
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-200 block">
                        {task.Title}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-gray-400">
                          {t("fromCourse")}
                        </span>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {task.CourseTitle}
                        </span>
                      </div>
                    </div>
                    <span className="text-blue-600 text-xs font-semibold whitespace-nowrap ml-2">
                      {task.Deadline
                        ? format.dateTime(new Date(task.Deadline), {
                            dateStyle: "medium",
                          })
                        : t("noDate")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 text-right">
              <Link
                href="/tasks"
                className="text-sm text-blue-600 hover:underline"
              >
                {t("viewAll")} &rarr;
              </Link>
            </div>
          </div>
        </div>

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {indexT("recentFiles")}
            </h2>
            <Link
              href="/courses"
              className="text-sm text-blue-600 hover:underline"
            >
              {t("browseCourses")} &rarr;
            </Link>
          </div>

          {filesLoading ? (
            <div className="text-center py-10">
              <Loader2 className="animate-spin w-8 h-8 text-blue-500 mx-auto" />
            </div>
          ) : filesError ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 rounded-lg">
              {t("failedRecentFiles")}
            </div>
          ) : Array.isArray(recentFiles) && recentFiles.length > 0 ? (
            <FileBrowser files={recentFiles} cacheKey="/api/files/recent" />
          ) : (
            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-gray-500">{t("noFilesDownloaded")}</p>
              <p className="text-sm text-gray-400 mt-1">
                {t("syncHint")}
              </p>
            </div>
          )}
        </section>
      </PageContainer>
    </div>
  );
}
