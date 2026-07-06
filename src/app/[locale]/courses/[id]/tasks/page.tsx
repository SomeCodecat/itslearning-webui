"use client";

import { use } from "react";
import { PageContainer } from "@/components/PageContainer";
import { CourseNav } from "@/components/CourseNav";
import { TaskList } from "@/components/TaskList";

export default function CourseTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <CourseNav courseId={id} />
        <TaskList courseId={id} />
      </PageContainer>
    </div>
  );
}
