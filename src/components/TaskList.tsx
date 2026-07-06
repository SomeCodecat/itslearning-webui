"use client";

import { useTranslations, useFormatter } from "next-intl";
import useSWR from "swr";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";
import { buildCsv } from "@/lib/exportCsv";
import { EmptyState } from "./ui/EmptyState";
import { ErrorState } from "./ui/ErrorState";
import { LoadingState } from "./ui/LoadingState";

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
      <div className="mt-[18px] border-t border-line pt-[18px]">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Loader2 size={16} className="animate-spin" />
        {t("loadingDetails")}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-[18px] border-t border-line pt-[18px] text-sm text-error">
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
    <div className="mt-[18px] border-t border-line pt-[18px]">
      <div className="mb-[22px] grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-[18px]">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary font-mono">
            {t("course")}
          </p>
          <p className="text-sm text-text-primary">
            {taskDetails.course?.title || task.CourseTitle || t("unknown")}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary font-mono">
            {t("statusLabel")}
          </p>
          <p className="text-sm text-text-primary">
            {formatStatus(taskDetails.status || task.Status)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary font-mono">
            {t("deadlineLabel")}
          </p>
          <p className="text-sm text-text-primary">
            {formatDate(taskDetails.deadline || task.Deadline, t("none"), format)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary font-mono">
            {t("elementId")}
          </p>
          <p className="text-sm font-mono text-text-secondary">
            {taskDetails.elementId || task.TaskId || t("unknown")}
          </p>
        </div>
      </div>

      <div className="grid gap-7 md:grid-cols-2">
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-text-primary">
              {t("statusScale")}
            </h4>
            {statusScale?.Description && (
              <p className="text-sm text-text-secondary">
                {statusScale.Description}
              </p>
            )}
          </div>

          {statusScale ? (
            <div className="space-y-2">
              {statusScale.Title && (
                <p className="text-sm text-text-secondary">
                  {statusScale.Title}
                </p>
              )}
              {statusItems.length > 0 ? (
                <ul className="space-y-2">
                  {statusItems.map((item, index) => (
                    <li
                      key={item.AssessmentStatusItemId ?? index}
                      className="border-l-2 border-line-strong pl-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-text-primary">
                          {item.Title || t("untitledStatus")}
                        </span>
                        {item.IsInitialStatus && (
                          <span className="rounded-[4px] bg-elevated px-2 py-0.5 text-[10px] text-text-tertiary">
                            {t("initial")}
                          </span>
                        )}
                        {item.IsSubmitted && (
                          <span className="rounded-[4px] bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold text-accent-text">
                            {t("submitted")}
                          </span>
                        )}
                        {item.IsCompleted && (
                          <span className="rounded-[4px] bg-success-subtle px-2 py-0.5 text-[10px] font-semibold text-success">
                            {t("completed")}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">
                  {t("noStatusItems")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              {t("noStatusScale")}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-text-primary">
              {t("assessmentScale")}
            </h4>
            {assessmentScale?.Description && (
              <p className="text-sm text-text-secondary">
                {assessmentScale.Description}
              </p>
            )}
          </div>

          {assessmentScale ? (
            <div className="space-y-2">
              {assessmentScale.Title && (
                <p className="text-sm text-text-secondary">
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
                        className="border-l-2 border-line-strong pl-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-text-primary">
                            {item.Title || t("untitledAssessment")}
                          </span>
                          {range && (
                            <span className="rounded-[4px] bg-elevated px-2 py-0.5 text-xs font-mono text-text-secondary">
                              {range}
                            </span>
                          )}
                        </div>
                        {item.Description && (
                          <p className="mt-1 text-sm text-text-secondary">
                            {item.Description}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">
                  {t("noAssessmentItems")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              {t("noAssessmentScale")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function TaskList({ courseId }: { courseId?: string }) {
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

  const swrUrl = courseId
    ? `/api/tasks?status=${status}&courseId=${courseId}`
    : `/api/tasks?status=${status}`;

  const {
    data: tasks,
    error,
    isLoading,
  } = useSWR<TaskView[]>(swrUrl, fetcher);

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

  const handleExportCsv = () => {
    const headers = [
      t("course"),
      t("title"),
      t("deadline"),
      t("statusLabel"),
    ];

    const rows = sortedTasks.map((task) => [
      task.CourseTitle || "",
      task.Title || "",
      task.Deadline ? formatDate(task.Deadline, t("none"), format) : t("none"),
      task.Status === "Completed"
        ? t("status.completed")
        : task.Status === "Active"
          ? t("status.active")
          : task.Status || "",
    ]);

    const csvContent = buildCsv(headers, rows);
    const dateString = new Date().toISOString().split("T")[0];
    const filename = `tasks-${dateString}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <div className="rounded-card border border-line bg-card p-4 md:px-5 md:py-4">
        {/* Prominent Tabs */}
        <div className="mb-4 flex items-center justify-between border-b border-line">
          <div className="flex gap-1 overflow-x-auto">
            {(["Active", "Completed", "All"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`border-b-2 px-3 pb-3 text-sm transition-colors md:px-4 ${
                  status === s
                    ? "border-accent text-accent-text font-semibold"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCsv}
            disabled={sortedTasks.length === 0}
            className="hidden items-center gap-2 rounded-control border border-line-strong bg-elevated px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-elevated-strong disabled:cursor-not-allowed disabled:opacity-50 md:flex"
            aria-label={t("exportAriaLabel")}
          >
            <Download size={14} />
            <span>{t("exportLabel")}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-control border border-line-strong bg-elevated py-[9px] pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="hidden gap-3 md:flex">
            {/* Course Filter (Only show when not in course-scoped view) */}
            {!courseId && (
              <select
                className="w-[170px] rounded-control border border-line-strong bg-elevated px-3 py-[9px] text-xs font-semibold text-text-secondary outline-none focus:border-accent"
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
            )}

            {/* Sort */}
            <select
              className="w-[180px] rounded-control border border-line-strong bg-elevated px-3 py-[9px] text-xs font-semibold text-text-secondary outline-none focus:border-accent"
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

      {isLoading && (
        <LoadingState label={t("loading")} />
      )}
      {error && (
        <ErrorState message={t("loadFailed")} />
      )}

      <div className="flex flex-col gap-3">
        {sortedTasks.map((task) => {
          const taskId = getTaskLookupId(task);
          const isOpen = taskId !== null && openTaskId === taskId;

          return (
            <div
              key={getTaskKey(task)}
              className={`rounded-card border bg-card p-4 transition-colors md:px-[18px] md:py-4 ${
                isOpen
                  ? "border-accent shadow-[0_0_0_3px_var(--accent-subtle)]"
                  : "border-line hover:border-line-strong"
              }`}
            >
              <div className="flex items-center justify-between gap-3 max-md:items-start">
                <button
                  type="button"
                  onClick={() => {
                    if (!taskId) return;
                    setOpenTaskId((current) =>
                      current === taskId ? null : taskId,
                    );
                  }}
                  disabled={!taskId}
                  className="flex flex-1 items-start gap-3 text-left focus:outline-none disabled:cursor-not-allowed md:gap-3.5"
                >
                  <span className={`mt-0.5 flex-none ${isOpen ? "text-accent-text" : "text-text-tertiary"}`}>
                    {isOpen ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-text-primary">
                      {task.Title}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-[5px] bg-elevated px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                        {task.CourseTitle}
                      </span>
                      <span
                        className={`rounded-[5px] px-2 py-0.5 text-[11px] font-semibold ${
                          task.Status === "Completed"
                            ? "bg-success-subtle text-success"
                            : "bg-accent-subtle text-accent-text"
                        }`}
                      >
                        {task.Status === "Completed"
                          ? t("status.completed")
                          : task.Status === "Active"
                            ? t("status.active")
                            : task.Status}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs font-mono text-text-tertiary">
                      {t("deadline")}: {formatDate(task.Deadline, t("none"), format)}
                    </span>
                  </span>
                </button>

                {task.Url && (
                  <a
                    href={task.Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${isOpen ? "max-md:flex" : "max-md:hidden"} inline-flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover max-md:w-full max-md:justify-center`}
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
          <EmptyState
            icon={<ClipboardList size={20} />}
            title={t("noMatches")}
          />
        )}
      </div>
    </div>
  );
}
