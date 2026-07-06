"use client";

import { useTranslations } from "next-intl";
import { GraduationCap } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { GradesTable } from "@/components/GradesTable";

export default function GradesPage() {
  const t = useTranslations("Grades");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-4 py-4 md:px-10 md:py-6">
        <header className="mb-[18px]">
          <h1 className="flex items-center gap-2 text-xl font-bold text-text-primary md:text-2xl">
            <GraduationCap className="h-5 w-5 text-accent-text" />
            {t("title")}
          </h1>
        </header>

        <GradesTable />
      </PageContainer>
    </div>
  );
}
