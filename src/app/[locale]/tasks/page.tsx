"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";

const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Request failed");
  }

  return response.json();
};

function getTaskLookupId(task: any): string | null {
  const id =
    task.id ??
    task.Id ??
    task.AssignmentId ??
    task.AssignmentID ??
    task.TaskRowId ??
    task.TaskId;

  return id === null || id === undefined ? null : String(id);
}

function getTaskKey(task: any): string {
  return getTaskLookupId(task) ?? task.Title ?? "task";
}

function formatDate(value: any): string {
  if (!value) {
    return "None";
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return "None";
  }

  return date.toLocaleString();
}

function getAssignmentSettings(taskDetails: any) {
  return taskDetails?.details &&
    typeof taskDetails.details === "object" &&
    !Array.isArray(taskDetails.details)
    ? taskDetails.details
    : taskDetails;
}

function getAssessmentRange(item: any): string | null {
  const from = item.PercentFromAndIncl;
  const to = item.PercentTo;
  const hasFrom = typeof from === "number";
  const hasTo = typeof to === "number";

  if (hasFrom && hasTo) {
    return `${from}% - ${to}%`;
  }

  if (hasFrom) {
    return `From ${from}%`;
  }

  if (hasTo) {
    return `Up to ${to}%`;
  }

  return null;
}

function TaskDetailsPanel({
  task,
  taskDetails,
  error,
  isLoading,
}: {
  task: any;
  taskDetails: any;
  error: any;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mt-5 border-t border-gray-100 dark:border-gray-700 pt-5 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        Loading details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-5 border-t border-gray-100 dark:border-gray-700 pt-5 text-sm text-red-600">
        Failed to load details.
      </div>
    );
  }

  if (!taskDetails) {
    return null;
  }

  const settings = getAssignmentSettings(taskDetails);
  const statusScale = settings?.StatusScale;
  const assessmentScale = settings?.AssessmentScale;
  const statusItems = Array.isArray(statusScale?.StatusItems)
    ? statusScale.StatusItems
    : [];
  const assessmentItems = Array.isArray(assessmentScale?.AssessmentItems)
    ? assessmentScale.AssessmentItems
    : [];

  return (
    <div className="mt-5 border-t border-gray-100 dark:border-gray-700 pt-5 space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">Course</p>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {taskDetails.course?.title || task.CourseTitle || "Unknown"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">Status</p>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {taskDetails.status || task.Status || "Unknown"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">
            Deadline
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {formatDate(taskDetails.deadline || task.Deadline)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">
            Element ID
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {taskDetails.elementId || task.TaskId || "Unknown"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Status scale
            </h4>
            {statusScale?.Description && (
              <p className="text-sm text-gray-500">
                {statusScale.Description}
              </p>
            )}
          </div>

          {statusScale ? (
            <div className="space-y-2">
              {statusScale.Title && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {statusScale.Title}
                </p>
              )}
              {statusItems.length > 0 ? (
                <ul className="space-y-2">
                  {statusItems.map((item: any, index: number) => (
                    <li
                      key={item.AssessmentStatusItemId ?? index}
                      className="border-l-2 border-gray-200 dark:border-gray-700 pl-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-800 dark:text-gray-100">
                          {item.Title || "Untitled status"}
                        </span>
                        {item.IsInitialStatus && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                            Initial
                          </span>
                        )}
                        {item.IsSubmitted && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            Submitted
                          </span>
                        )}
                        {item.IsCompleted && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Completed
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  No status items returned.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No status scale returned.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Assessment scale
            </h4>
            {assessmentScale?.Description && (
              <p className="text-sm text-gray-500">
                {assessmentScale.Description}
              </p>
            )}
          </div>

          {assessmentScale ? (
            <div className="space-y-2">
              {assessmentScale.Title && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {assessmentScale.Title}
                </p>
              )}
              {assessmentItems.length > 0 ? (
                <ul className="space-y-2">
                  {assessmentItems.map((item: any, index: number) => {
                    const range = getAssessmentRange(item);

                    return (
                      <li
                        key={item.AssessmentItemId ?? index}
                        className="border-l-2 border-gray-200 dark:border-gray-700 pl-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-gray-800 dark:text-gray-100">
                            {item.Title || "Untitled assessment"}
                          </span>
                          {range && (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                              {range}
                            </span>
                          )}
                        </div>
                        {item.Description && (
                          <p className="mt-1 text-sm text-gray-500">
                            {item.Description}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  No assessment items returned.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No assessment scale returned.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const {
    data: tasks,
    error,
    isLoading,
  } = useSWR(`/api/tasks?status=${status}`, fetcher);
  const {
    data: taskDetails,
    error: taskDetailsError,
    isLoading: isTaskDetailsLoading,
  } = useSWR(openTaskId ? `/api/tasks/${openTaskId}` : null, fetcher);

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
          {sortedTasks.map((task: any) => {
            const taskId = getTaskLookupId(task);
            const isOpen = taskId !== null && openTaskId === taskId;

            return (
              <div
                key={getTaskKey(task)}
                className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (!taskId) return;
                      setOpenTaskId((current) =>
                        current === taskId ? null : taskId,
                      );
                    }}
                    disabled={!taskId}
                    className="flex flex-1 items-start gap-3 text-left focus:outline-none disabled:cursor-not-allowed"
                  >
                    <span className="mt-0.5 text-gray-400">
                      {isOpen ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </span>
                    <span>
                      <span className="block font-semibold text-gray-900 dark:text-white">
                        {task.Title}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 mt-1">
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
                      </span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Deadline: {formatDate(task.Deadline)}
                      </span>
                    </span>
                  </button>

                  {task.Url && (
                    <a
                      href={task.Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                    >
                      <ExternalLink size={14} />
                      Open
                    </a>
                  )}
                </div>

                {isOpen && (
                  <TaskDetailsPanel
                    task={task}
                    taskDetails={taskDetails}
                    error={taskDetailsError}
                    isLoading={isTaskDetailsLoading}
                  />
                )}
              </div>
            );
          })}
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
