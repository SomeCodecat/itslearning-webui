"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import useSWR from "swr"; // Fetching data
import { PageContainer } from "@/components/PageContainer";
import { Clock3, FileText, FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type DashboardTask = {
  TaskId: number | string;
  Title: string;
  CourseTitle?: string;
  Deadline?: string | null;
};

type DashboardFile = {
  id?: number | string;
  customName?: string;
  fileName?: string;
  type?: string | null;
  size?: string | null;
  courseTitle?: string | null;
  uploadedAt?: string | null;
};

function getDeadlineTone(deadline?: string | null) {
  if (!deadline) return "bg-accent shadow-[0_0_0_4px_var(--accent-subtle)]";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return "bg-accent shadow-[0_0_0_4px_var(--accent-subtle)]";
  }
  const now = new Date();
  if (date.getTime() < now.getTime()) {
    return "bg-error shadow-[0_0_0_4px_var(--error-subtle)]";
  }
  if (date.toDateString() === now.toDateString()) {
    return "bg-warning shadow-[0_0_0_4px_var(--warning-subtle)]";
  }
  return "bg-accent shadow-[0_0_0_4px_var(--accent-subtle)]";
}

function getDeadlineStatus(
  deadline: string | null | undefined,
  t: ReturnType<typeof useTranslations<"Dashboard">>,
  format: ReturnType<typeof useFormatter>,
) {
  if (!deadline) {
    return {
      text: t("noDate"),
      color: "text-text-secondary",
      formattedDate: "",
    };
  }

  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return {
      text: "",
      color: "",
      formattedDate: "",
    };
  }

  const now = new Date();
  const isOverdue = date.getTime() < now.getTime();
  const isToday = date.toDateString() === now.toDateString();

  const formattedTime = format.dateTime(date, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const formattedDate = format.dateTime(date, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  if (isOverdue) {
    return {
      text: t("overdue"),
      color: "text-error",
      formattedDate: formattedDate,
    };
  }

  if (isToday) {
    return {
      text: t("today"),
      color: "text-warning",
      formattedDate: t("dueAt", { time: formattedTime }),
    };
  }

  const relTime = format.relativeTime(date);
  const capitalizedRelTime = relTime.charAt(0).toUpperCase() + relTime.slice(1);

  return {
    text: capitalizedRelTime,
    color: "text-text-secondary",
    formattedDate: formattedDate,
  };
}

function getFileTone(value?: string | null) {
  const extension = (value || "FILE").replace(/^\./, "").slice(0, 4).toUpperCase();
  if (extension.startsWith("XL")) return "bg-success-subtle text-success";
  if (extension.startsWith("PP")) return "bg-sky-subtle text-sky";
  if (extension.startsWith("DO")) return "bg-warning-subtle text-warning";
  return "bg-accent-subtle text-accent-text";
}

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
  } = useSWR<DashboardFile[]>("/api/files/recent", fetcher);

  // Filter tasks for upcoming deadlines (optional, API already does Active)
  // We can take top 5
  const upcomingDeadlines = Array.isArray(tasks) ? tasks.slice(0, 5) : [];
  const newFiles = Array.isArray(recentFiles) ? recentFiles.slice(0, 5) : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-6 py-6 md:px-10 md:py-10">
        <header className="mb-6 md:mb-[26px]">
          <h1 className="mb-1 text-xl font-bold text-text-primary md:text-[28px]">
            {indexT("title")}
          </h1>
          <p className="text-sm text-text-secondary">{indexT("welcome")}</p>
        </header>

        {/* Dashboard Widgets */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr] md:gap-4">
          {/* Widget 1: Upcoming Deadlines */}
          <section className="flex flex-col rounded-card border border-line bg-card px-4 py-[15px] md:px-[22px] md:py-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-card-title text-text-primary">
                <Clock3 className="h-4 w-4 text-accent-text" />
                {t("upcomingDeadlines")}
              </h2>
              <Link href="/tasks" className="text-xs font-semibold text-accent-text">
                {t("viewAll")}
              </Link>
            </div>
            {tasksLoading ? (
              <LoadingState label="" />
            ) : tasksError ? (
              <ErrorState message={t("failedDeadlines")} />
            ) : upcomingDeadlines.length === 0 ? (
              <EmptyState icon={<Clock3 size={20} />} title={t("noActiveDeadlines")} />
            ) : (
              <ul className="flex flex-col">
                {upcomingDeadlines.map((task) => (
                  <li
                    key={task.TaskId}
                    className="flex items-center gap-[13px] border-b border-line py-3 text-sm last:border-b-0"
                  >
                    <span className={`h-[9px] w-[9px] flex-none rounded-[3px] ${getDeadlineTone(task.Deadline)}`} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-text-primary">
                        {task.Title}
                      </span>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[11px] text-text-tertiary">
                          {t("fromCourse")}
                        </span>
                        <span className="rounded-[5px] bg-elevated px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                          {task.CourseTitle}
                        </span>
                      </div>
                    </div>
                    {task.Deadline ? (
                      (() => {
                        const { text, color, formattedDate } = getDeadlineStatus(task.Deadline, t, format);
                        return (
                          <div className="ml-2 flex-none text-right">
                            <div className={`font-mono text-xs font-semibold ${color}`}>
                              {text}
                            </div>
                            <div className="font-mono text-[11px] text-text-tertiary">
                              {formattedDate}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="ml-2 whitespace-nowrap text-right font-mono text-xs font-semibold text-text-secondary">
                        {t("noDate")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col rounded-card border border-line bg-card px-4 py-[15px] md:px-[22px] md:py-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-card-title text-text-primary">
                <FileText className="h-4 w-4 text-accent-text" />
                {t("newFiles")}
              </h2>
            <Link
              href="/courses"
                className="text-xs font-semibold text-accent-text"
            >
              {t("browseCourses")}
            </Link>
          </div>

          {filesLoading ? (
              <LoadingState label="" />
          ) : filesError ? (
              <ErrorState message={t("failedRecentFiles")} />
            ) : newFiles.length > 0 ? (
              <ul className="flex flex-col">
                {newFiles.map((file, index) => {
                  const name = file.customName || file.fileName || "";
                  const extension = file.type || name.split(".").pop() || "FILE";
                  return (
                    <li
                      key={file.id ?? name ?? index}
                      className="flex items-center gap-3 border-b border-line py-[11px] last:border-b-0"
                    >
                      <span className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] font-mono text-[10px] font-bold ${getFileTone(extension)}`}>
                        {extension.slice(0, 4).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-text-primary">
                          {name}
                        </p>
                        <p className="truncate text-[11px] text-text-tertiary">
                          {[file.courseTitle, file.size].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {file.uploadedAt && (
                        <span className="flex-none font-mono text-[11px] text-text-tertiary">
                          {format.relativeTime(new Date(file.uploadedAt))}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
          ) : (
              <EmptyState
                icon={<FolderOpen size={20} />}
                title={t("noFilesDownloaded")}
                hint={t("syncHint")}
              />
          )}
        </section>
        </div>
      </PageContainer>
    </div>
  );
}
