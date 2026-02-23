import React from "react";
import { useTranslations } from "next-intl";

export function Dashboard() {
  const t = useTranslations("Dashboard");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Upcoming Deadlines Widget */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          {t("upcomingDeadlines")}
        </h2>
        <div className="space-y-3">
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-800">
            <div className="flex justify-between items-start">
              <span className="font-medium text-gray-900 dark:text-white">
                Math Assignment 1
              </span>
              <span className="text-xs text-yellow-600 dark:text-yellow-400 font-bold">
                {t("today")}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t("dueAt", { time: "23:59" })}
            </p>
          </div>
          {/* Placeholder empty state if needed */}
        </div>
      </div>

      {/* New Files Widget */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          {t("newFiles")}
        </h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer">
            <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900 grid place-items-center text-blue-600">
              📄
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                Exam_Prep_2025.pdf
              </p>
              <p className="text-xs text-gray-500">Course: English</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
