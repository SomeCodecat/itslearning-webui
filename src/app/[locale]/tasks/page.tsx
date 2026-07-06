"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/PageContainer";
import { TaskList } from "@/components/TaskList";

export default function TasksPage() {
  const t = useTranslations("Tasks");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-6 py-6 md:px-10 md:py-7 md:pb-10">
        <header className="mb-5">
          <h1 className="text-xl font-bold text-text-primary md:text-[28px]">
            {t("title")}
          </h1>
        </header>

        <TaskList />
      </PageContainer>
    </div>
  );
}
