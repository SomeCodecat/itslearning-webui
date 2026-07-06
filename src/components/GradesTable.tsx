"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { ExternalLink, Loader2, Download } from "lucide-react";
import { buildCsv } from "@/lib/exportCsv";

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
    <div className="space-y-6">
      {/* Toolbar / Export */}
      <div className="flex justify-end">
        <button
          onClick={handleExportCsv}
          disabled={!grades || grades.length === 0}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={t("exportAriaLabel")}
        >
          <Download size={16} />
          <span>{t("exportLabel")}</span>
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
          <Loader2 size={18} className="animate-spin text-blue-500" />
          {t("loading")}
        </div>
      )}

      {error && (
        <div className="text-center py-10 text-red-600">
          {t("loadFailed")}
        </div>
      )}

      {!isLoading && !error && courseTitles.length === 0 && (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500">{t("empty")}</p>
        </div>
      )}

      <div className="space-y-8">
        {courseTitles.map((courseTitle) => (
          <section key={courseTitle}>
            {/* Show course title heading only if we are in the global view */}
            {!courseId && (
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                {courseTitle}
              </h2>
            )}

            <div className="space-y-3">
              {groupedGrades[courseTitle].map((grade) => (
                <article
                  key={grade.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {grade.assignmentTitle}
                      </h3>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {grade.feedback || t("noFeedback")}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="rounded-md bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
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
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
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
