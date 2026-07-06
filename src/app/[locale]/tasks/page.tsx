"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/PageContainer";
import { TaskList } from "@/components/TaskList";

export default function TasksPage() {
  const t = useTranslations("Tasks");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <header className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t("title")}
            </h1>
          </div>
        </header>

        <TaskList />
      </PageContainer>
    </div>
  );
}
