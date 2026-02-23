"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import useSWR from "swr"; // Fetching data
import { FileBrowser } from "@/components/FileBrowser";
import { Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const t = useTranslations("Index");

  // 1. Fetch Tasks (Deadlines)
  const {
    data: tasks,
    error: tasksError,
    isLoading: tasksLoading,
  } = useSWR("/api/tasks?status=Active", fetcher);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t("title")}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">{t("welcome")}</p>
            </div>
          </div>
        </header>

        {/* Dashboard Widgets */}
        <div className="mb-8">
          {/* Widget 1: Upcoming Deadlines */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Upcoming Deadlines
            </h3>
            {tasksLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="animate-spin text-blue-500" />
              </div>
            ) : tasksError ? (
              <p className="text-red-500 text-sm">Failed to load deadlines.</p>
            ) : upcomingDeadlines.length === 0 ? (
              <p className="text-gray-500 text-sm">No active deadlines.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingDeadlines.map((task: any) => (
                  <li
                    key={task.TaskId}
                    className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0"
                  >
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-200 block">
                        {task.Title}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-gray-400">from</span>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {task.CourseTitle}
                        </span>
                      </div>
                    </div>
                    <span className="text-blue-600 text-xs font-semibold whitespace-nowrap ml-2">
                      {task.Deadline
                        ? new Date(task.Deadline).toLocaleDateString()
                        : "No Date"}
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
                View All &rarr;
              </Link>
            </div>
          </div>
        </div>

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t("recentFiles")}
            </h2>
            <Link
              href="/courses"
              className="text-sm text-blue-600 hover:underline"
            >
              Browse Courses &rarr;
            </Link>
          </div>

          {filesLoading ? (
            <div className="text-center py-10">
              <Loader2 className="animate-spin w-8 h-8 text-blue-500 mx-auto" />
            </div>
          ) : filesError ? (
            <div className="p-4 bg-red-50 text-red-500 rounded-lg">
              Failed to load recent files.
            </div>
          ) : Array.isArray(recentFiles) && recentFiles.length > 0 ? (
            <FileBrowser files={recentFiles} />
          ) : (
            <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-gray-500">No files downloaded yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Use the "Sync Now" button to fetch course materials.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
