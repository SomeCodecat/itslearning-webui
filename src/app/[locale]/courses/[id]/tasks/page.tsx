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
    <PageContainer className="px-6 py-6 md:px-10 md:py-7 md:pb-10">
        <CourseNav courseId={id} />
        <h2 className="mb-4 text-card-title text-text-primary">
          {tCourse("tasks")}
        </h2>
        <TaskList courseId={id} />
      </PageContainer>
  );
}
