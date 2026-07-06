import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/PageContainer";
import { LoadingState } from "@/components/ui/LoadingState";

export default function Loading() {
  const t = useTranslations("CourseDetail");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-4 py-4 md:px-10 md:py-7 md:pb-10">
        <header className="mb-4">
          <h1 className="mb-2 animate-pulse text-xl font-bold text-text-primary md:text-[28px]">
            {t("loadingCourse")}
          </h1>
          <div className="mb-4 h-10 w-full animate-pulse rounded-control bg-elevated"></div>
        </header>

        <LoadingState label={t("preparingResources")} />
      </PageContainer>
    </div>
  );
}
