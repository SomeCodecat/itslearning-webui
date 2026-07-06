"use client";

import { useTranslations, useFormatter } from "next-intl";
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

type TaskView = {
  id?: number | string | null;
  Id?: number | string | null;
  AssignmentId?: number | string | null;
  AssignmentID?: number | string | null;
  TaskRowId?: number | string | null;
  TaskId?: number | string | null;
  Title?: string;
  CourseTitle?: string;
  Status?: string;
  Deadline?: string | null;
  Url?: string | null;
};

type ScaleItem = {
  AssessmentStatusItemId?: number | string | null;
  AssessmentItemId?: number | string | null;
  Title?: string | null;
  Description?: string | null;
  IsInitialStatus?: boolean;
  IsSubmitted?: boolean;
  IsCompleted?: boolean;
  PercentFromAndIncl?: number;
  PercentTo?: number;
};

type StatusScale = {
  Title?: string | null;
  Description?: string | null;
  StatusItems?: ScaleItem[];
};

type AssessmentScale = {
  Title?: string | null;
  Description?: string | null;
  AssessmentItems?: ScaleItem[];
};

type AssignmentSettings = {
  StatusScale?: StatusScale;
  AssessmentScale?: AssessmentScale;
};

type TaskDetails = TaskView &
  AssignmentSettings & {
    status?: string;
    deadline?: string | null;
    elementId?: number | string | null;
    course?: { title?: string | null } | null;
    details?: AssignmentSettings | null;
  };

function getTaskLookupId(task: TaskView): string | null {
  const id =
    task.id ??
    task.Id ??
    task.AssignmentId ??
    task.AssignmentID ??
    task.TaskRowId ??
    task.TaskId;

  return id === null || id === undefined ? null : String(id);
}

function getTaskKey(task: TaskView): string {
  return getTaskLookupId(task) ?? task.Title ?? "task";
}

function formatDate(
  value: unknown,
  noneLabel: string,
  format: ReturnType<typeof useFormatter>,
): string {
  if (!value) {
    return noneLabel;
  }

  if (
    !(value instanceof Date) &&
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return noneLabel;
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return noneLabel;
  }

  return format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });
}

function getAssignmentSettings(taskDetails: TaskDetails): AssignmentSettings {
  return taskDetails?.details &&
    typeof taskDetails.details === "object" &&
    !Array.isArray(taskDetails.details)
    ? taskDetails.details
    : taskDetails;
}

function getAssessmentRange(
  item: ScaleItem,
  labels: {
    from: (value: number) => string;
    upTo: (value: number) => string;
  },
): string | null {
  const from = item.PercentFromAndIncl;
  const to = item.PercentTo;
  const hasFrom = typeof from === "number";
  const hasTo = typeof to === "number";

  if (hasFrom && hasTo) {
    return `${from}% - ${to}%`;
  }

  if (hasFrom) {
    return labels.from(from);
  }

  if (hasTo) {
    return labels.upTo(to);
  }

  return null;
}

function TaskDetailsPanel({
  task,
  taskDetails,
  error,
  isLoading,
}: {
  task: TaskView;
  taskDetails: TaskDetails | undefined;
  error: unknown;
  isLoading: boolean;
}) {
  const t = useTranslations("Tasks");
  const format = useFormatter();
  const formatStatus = (value: unknown) => {
    if (value === "Active") return t("status.active");
    if (value === "Completed") return t("status.completed");
    if (value === "All") return t("status.all");
    return typeof value === "string" && value ? value : t("unknown");
  };

  if (isLoading) {
    return (
      <div className="mt-5 border-t border-gray-100 dark:border-gray-700 pt-5 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        {t("loadingDetails")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-5 border-t border-gray-100 dark:border-gray-700 pt-5 text-sm text-red-600">
        {t("detailsFailed")}
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
          <p className="text-xs font-medium uppercase text-gray-400">
            {t("course")}
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {taskDetails.course?.title || task.CourseTitle || t("unknown")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">
            {t("statusLabel")}
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {formatStatus(taskDetails.status || task.Status)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">
            {t("deadlineLabel")}
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {formatDate(taskDetails.deadline || task.Deadline, t("none"), format)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">
            {t("elementId")}
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            {taskDetails.elementId || task.TaskId || t("unknown")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("statusScale")}
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
                  {statusItems.map((item, index) => (
                    <li
                      key={item.AssessmentStatusItemId ?? index}
                      className="border-l-2 border-gray-200 dark:border-gray-700 pl-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-800 dark:text-gray-100">
                          {item.Title || t("untitledStatus")}
                        </span>
                        {item.IsInitialStatus && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                            {t("initial")}
                          </span>
                        )}
                        {item.IsSubmitted && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {t("submitted")}
                          </span>
                        )}
                        {item.IsCompleted && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            {t("completed")}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  {t("noStatusItems")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {t("noStatusScale")}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("assessmentScale")}
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
                  {assessmentItems.map((item, index) => {
                    const range = getAssessmentRange(item, {
                      from: (value) => t("assessmentFrom", { value }),
                      upTo: (value) => t("assessmentUpTo", { value }),
                    });

                    return (
                      <li
                        key={item.AssessmentItemId ?? index}
                        className="border-l-2 border-gray-200 dark:border-gray-700 pl-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-gray-800 dark:text-gray-100">
                            {item.Title || t("untitledAssessment")}
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
                  {t("noAssessmentItems")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {t("noAssessmentScale")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const t = useTranslations("Tasks");
  const format = useFormatter();
  const [status, setStatus] = useState<"Active" | "Completed" | "All">(
    "Active",
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"deadline_asc" | "deadline_desc">(
    "deadline_asc",
  );
  const [courseFilter, setCourseFilter] = useState("All");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const statusLabels = {
    Active: t("status.active"),
    Completed: t("status.completed"),
    All: t("status.all"),
  };

  const {
    data: tasks,
    error,
    isLoading,
  } = useSWR<TaskView[]>(`/api/tasks?status=${status}`, fetcher);
  const {
    data: taskDetails,
    error: taskDetailsError,
    isLoading: isTaskDetailsLoading,
  } = useSWR<TaskDetails>(
    openTaskId ? `/api/tasks/${openTaskId}` : null,
    fetcher,
  );

  // Derived state for filtering
  const filteredTasks = Array.isArray(tasks)
    ? tasks.filter((task) => {
        const matchesSearch = (task.Title ?? "").toLowerCase().includes(
          search.toLowerCase(),
        );
        const matchesCourse =
          courseFilter === "All" || task.CourseTitle === courseFilter;
        return matchesSearch && matchesCourse;
      })
    : [];

  // Derived state for sorting
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const dateA = a.Deadline ? new Date(a.Deadline).getTime() : Infinity;
    const dateB = b.Deadline ? new Date(b.Deadline).getTime() : Infinity;

    return sort === "deadline_asc" ? dateA - dateB : dateB - dateA;
  });

  // Extract unique courses for filter
  const courses = Array.isArray(tasks)
    ? Array.from(
        new Set(
          tasks
            .map((task) => task.CourseTitle)
            .filter((title): title is string => typeof title === "string"),
        ),
      ).sort()
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t("title")}
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
                  {statusLabels[s]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between">
              {/* Search */}
              <div className="flex-1 min-w-[250px]">
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
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
                  <option value="All">{t("allCourses")}</option>
                  {courses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Sort */}
                <select
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  value={sort}
                  onChange={(e) =>
                    setSort(e.target.value as "deadline_asc" | "deadline_desc")
                  }
                >
                  <option value="deadline_asc">{t("deadlineEarliest")}</option>
                  <option value="deadline_desc">{t("deadlineLatest")}</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        {isLoading && (
          <div className="text-gray-500 text-center py-10">
            {t("loading")}
          </div>
        )}
        {error && (
          <div className="text-red-500 text-center py-10">
            {t("loadFailed")}
          </div>
        )}

        <div className="space-y-4">
          {sortedTasks.map((task) => {
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
                          {task.Status === "Completed"
                            ? t("status.completed")
                            : task.Status === "Active"
                              ? t("status.active")
                              : task.Status}
                        </span>
                      </span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t("deadline")}: {formatDate(task.Deadline, t("none"), format)}
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
                      {t("open")}
                      <span className="sr-only"> ({t("opensInNewTab")})</span>
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
              <p className="text-gray-500">{t("noMatches")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
