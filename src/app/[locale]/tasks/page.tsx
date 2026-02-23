"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TasksPage() {
  const t = useTranslations("Index");
  const [status, setStatus] = useState<"Active" | "Completed" | "All">(
    "Active",
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"deadline_asc" | "deadline_desc">(
    "deadline_asc",
  );
  const [courseFilter, setCourseFilter] = useState("All");

  const {
    data: tasks,
    error,
    isLoading,
  } = useSWR(`/api/tasks?status=${status}`, fetcher);

  // Derived state for filtering
  const filteredTasks = Array.isArray(tasks)
    ? tasks.filter((task: any) => {
        const matchesSearch = task.Title.toLowerCase().includes(
          search.toLowerCase(),
        );
        const matchesCourse =
          courseFilter === "All" || task.CourseTitle === courseFilter;
        return matchesSearch && matchesCourse;
      })
    : [];

  // Derived state for sorting
  const sortedTasks = [...filteredTasks].sort((a: any, b: any) => {
    const dateA = a.Deadline ? new Date(a.Deadline).getTime() : Infinity;
    const dateB = b.Deadline ? new Date(b.Deadline).getTime() : Infinity;

    return sort === "deadline_asc" ? dateA - dateB : dateB - dateA;
  });

  // Extract unique courses for filter
  const courses = Array.isArray(tasks)
    ? Array.from(
        new Set(
          tasks
            .map((t: any) => t.CourseTitle)
            .filter((title: any) => title && typeof title === "string"),
        ),
      ).sort()
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Tasks
            </h1>
          </div>

          {/* Filters Toolbar */}
          {/* Filters Toolbar */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-6">
            {/* Prominent Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {(["Active", "Completed", "All"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-6 py-3 text-base font-medium transition-colors border-b-2 -mb-px ${
                    status === s
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between">
              {/* Search */}
              <div className="flex-1 min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search tasks..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                {/* Course Filter */}
                <select
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                >
                  <option value="All">All Courses</option>
                  {courses.map((c: any) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Sort */}
                <select
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                >
                  <option value="deadline_asc">Deadline (Earliest)</option>
                  <option value="deadline_desc">Deadline (Latest)</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        {isLoading && (
          <div className="text-gray-500 text-center py-10">
            Loading tasks...
          </div>
        )}
        {error && (
          <div className="text-red-500 text-center py-10">
            Failed to load tasks.
          </div>
        )}

        <div className="space-y-4">
          {sortedTasks.map((task: any) => (
            <div
              key={task.TaskId}
              className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center hover:border-blue-300 transition-colors"
            >
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {task.Title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                    {task.CourseTitle}
                  </span>
                  <span
                    className={`text-sm px-2 py-0.5 rounded ${
                      task.Status === "Completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {task.Status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Deadline:{" "}
                  {task.Deadline
                    ? new Date(task.Deadline).toLocaleString()
                    : "None"}
                </p>
              </div>
              <a
                href={task.Url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Open
              </a>
            </div>
          ))}
          {!isLoading && sortedTasks.length === 0 && (
            <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-gray-500">No tasks match your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
