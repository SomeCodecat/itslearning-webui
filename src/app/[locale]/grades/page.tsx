"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/PageContainer";
import { GradesTable } from "@/components/GradesTable";

export default function GradesPage() {
  const t = useTranslations("Grades");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-6 py-6 md:px-10">
        <header className="mb-[18px]">
          <h1 className="text-xl font-bold text-text-primary md:text-2xl">
            {t("title")}
          </h1>
        </header>

        <GradesTable />
      </PageContainer>
    </div>
  );
}
