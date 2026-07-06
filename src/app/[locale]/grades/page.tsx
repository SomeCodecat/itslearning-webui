"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { ExternalLink, GraduationCap, Loader2 } from "lucide-react";

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

function formatGrade(grade: GradeView): string {
  if (grade.gradeString) {
    return grade.gradeString;
  }

  if (typeof grade.score === "number") {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(grade.score);
  }

  return "Grade unavailable";
}

export default function GradesPage() {
  const t = useTranslations("Index");
  const { data: grades, error, isLoading } = useSWR("/api/grades", fetcher);

  const groupedGrades = Array.isArray(grades)
    ? grades.reduce<Record<string, GradeView[]>>((groups, grade) => {
        const courseTitle = grade.courseTitle || "Unknown course";
        groups[courseTitle] = groups[courseTitle] || [];
        groups[courseTitle].push(grade);
        return groups;
      }, {})
    : {};
  const courseTitles = Object.keys(groupedGrades).sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-[1200px] mx-auto">
        <header className="mb-8">
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
            <GraduationCap className="text-blue-600 dark:text-blue-400" />
            {t("grades")}
          </h1>
        </header>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
            <Loader2 size={18} className="animate-spin" />
            Loading grades...
          </div>
        )}

        {error && (
          <div className="text-center py-10 text-red-600">
            Failed to load grades.
          </div>
        )}

        {!isLoading && !error && courseTitles.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-gray-500">No grades synced yet</p>
          </div>
        )}

        <div className="space-y-8">
          {courseTitles.map((courseTitle) => (
            <section key={courseTitle}>
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                {courseTitle}
              </h2>

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
                          {grade.feedback || "No feedback"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded-md bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                          {formatGrade(grade)}
                        </span>
                        {grade.webUrl && (
                          <a
                            href={grade.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
                          >
                            Open
                            <ExternalLink size={14} />
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
    </div>
  );
}
