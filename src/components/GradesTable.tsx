"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Download, ExternalLink, GraduationCap } from "lucide-react";
import { buildCsv } from "@/lib/exportCsv";
import { EmptyState } from "./ui/EmptyState";
import { ErrorState } from "./ui/ErrorState";
import { LoadingState } from "./ui/LoadingState";

type GradeView = {
  id: number;
  assignmentTitle: string;
  courseTitle: string;
  gradeString: string | null;
  score: number | null;
  feedback: string | null;
  webUrl: string | null;
  updatedAt: string;
};

const fetcher = async (url: string): Promise<GradeView[]> => {
  const response = await fetch(url);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Request failed");
  }

  return response.json();
};

function formatGrade(grade: GradeView, unavailableLabel: string): string {
  if (grade.gradeString) {
    return grade.gradeString;
  }

  if (typeof grade.score === "number") {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(grade.score);
  }

  return unavailableLabel;
}

function getGradeTone(grade: GradeView): string {
  const rawGrade =
    grade.gradeString?.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ??
    (typeof grade.score === "number" ? String(grade.score) : null);
  const numericGrade = rawGrade ? Number(rawGrade) : Number.NaN;

  if (!Number.isNaN(numericGrade) && numericGrade <= 1.7) {
    return "bg-success-subtle text-success";
  }

  return "bg-accent-subtle text-accent-text";
}

export function GradesTable({ courseId }: { courseId?: string }) {
  const t = useTranslations("Grades");
  const swrUrl = courseId ? `/api/grades?courseId=${courseId}` : "/api/grades";
  const { data: grades, error, isLoading } = useSWR<GradeView[]>(swrUrl, fetcher);

  const groupedGrades = Array.isArray(grades)
    ? grades.reduce<Record<string, GradeView[]>>((groups, grade) => {
        const courseTitle = grade.courseTitle || t("unknownCourse");
        groups[courseTitle] = groups[courseTitle] || [];
        groups[courseTitle].push(grade);
        return groups;
      }, {})
    : {};

  const courseTitles = Object.keys(groupedGrades).sort((a, b) =>
    a.localeCompare(b),
  );

  const handleExportCsv = () => {
    if (!grades) return;

    // Use translations or fallbacks for columns
    const headers = [
      t("colCourse", { defaultMessage: "Course" }),
      t("colAssignment", { defaultMessage: "Assignment" }),
      t("colGrade", { defaultMessage: "Grade" }),
      t("colScore", { defaultMessage: "Score" }),
      t("colFeedback", { defaultMessage: "Feedback" }),
    ];

    const rows = grades.map((grade) => [
      grade.courseTitle || t("unknownCourse"),
      grade.assignmentTitle || "",
      grade.gradeString || "",
      grade.score !== null ? String(grade.score) : "",
      grade.feedback || "",
    ]);

    const csvContent = buildCsv(headers, rows);
    const dateString = new Date().toISOString().split("T")[0];
    const filename = `grades-${dateString}.csv`;

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
    <div className="space-y-[18px]">
      {/* Toolbar / Export */}
      <div className="flex justify-end">
        <button
          onClick={handleExportCsv}
          disabled={!grades || grades.length === 0}
          className="flex items-center gap-1.5 rounded-control border border-line-strong bg-elevated px-3 py-[7px] text-xs font-semibold text-text-secondary transition-colors hover:bg-elevated-strong disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t("exportAriaLabel")}
        >
          <Download size={13} />
          <span>{t("exportLabel")}</span>
        </button>
      </div>

      {isLoading && (
        <LoadingState label={t("loading")} />
      )}

      {error && (
        <ErrorState message={t("loadFailed")} />
      )}

      {!isLoading && !error && courseTitles.length === 0 && (
        <EmptyState icon={<GraduationCap size={20} />} title={t("empty")} />
      )}

      <div className="space-y-[18px]">
        {courseTitles.map((courseTitle) => (
          <section key={courseTitle}>
            {/* Show course title heading only if we are in the global view */}
            {!courseId && (
              <h2 className="mb-2.5 text-sm font-semibold text-text-secondary">
                {courseTitle}
              </h2>
            )}

            <div className="flex flex-col gap-2.5">
              {groupedGrades[courseTitle].map((grade) => (
                <article
                  key={grade.id}
                  className="rounded-card border border-line bg-card px-4 py-[15px]"
                >
                  <div className="flex items-start justify-between gap-3.5">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-text-primary">
                        {grade.assignmentTitle}
                      </h3>
                      <p className="mt-1 text-xs leading-normal text-text-tertiary">
                        {grade.feedback || t("noFeedback")}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-control px-[11px] py-[5px] font-mono text-sm font-bold ${getGradeTone(grade)}`}>
                        {formatGrade(grade, t("gradeUnavailable"))}
                      </span>
                      {grade.webUrl && (
                        <a
                          href={grade.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t("openInNewTab", {
                            title: grade.assignmentTitle,
                          })}
                          className="inline-flex items-center gap-1 rounded-control border border-line-strong bg-elevated px-3 py-[5px] text-xs font-semibold text-text-secondary transition-colors hover:bg-elevated-strong"
                        >
                          {t("open")}
                          <ExternalLink size={14} />
                          <span className="sr-only"> ({t("opensInNewTab")})</span>
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
