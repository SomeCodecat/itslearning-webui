"use client";

import { useTranslations } from "next-intl";
import { GraduationCap } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { GradesTable } from "@/components/GradesTable";

export default function GradesPage() {
  const t = useTranslations("Grades");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <header className="mb-8">
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
            <GraduationCap className="text-blue-600 dark:text-blue-400" />
            {t("title")}
          </h1>
        </header>

        <GradesTable />
      </PageContainer>
    </div>
  );
}
