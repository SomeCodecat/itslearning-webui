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
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-4 py-4 md:px-10 md:py-7 md:pb-10">
        <CourseNav courseId={id} />
        <GradesTable courseId={id} />
      </PageContainer>
    </div>
  );
}
