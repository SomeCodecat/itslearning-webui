"use client";

import { use } from "react";
import { PageContainer } from "@/components/PageContainer";
import { CourseNav } from "@/components/CourseNav";
import { GradesTable } from "@/components/GradesTable";

export default function CourseGradesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <CourseNav courseId={id} />
        <GradesTable courseId={id} />
      </PageContainer>
    </div>
  );
}
