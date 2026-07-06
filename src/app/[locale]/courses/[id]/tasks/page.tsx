"use client";

import { use } from "react";
import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/PageContainer";
import { CourseNav } from "@/components/CourseNav";
import { TaskList } from "@/components/TaskList";

export default function CourseTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tCourse = useTranslations("CourseDetail");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <CourseNav courseId={id} />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {tCourse("tasks")}
        </h2>
        <TaskList courseId={id} />
      </PageContainer>
    </div>
  );
}
