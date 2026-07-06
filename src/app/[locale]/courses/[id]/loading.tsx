import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";

export default function Loading() {
  const t = useTranslations("CourseDetail");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 animate-pulse">
            {t("loadingCourse")}
          </h1>
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-lg w-full animate-pulse mb-4"></div>
        </header>

        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin w-12 h-12 text-blue-500 mb-4" />
          <p className="text-gray-500 animate-pulse font-medium">
            {t("preparingResources")}
          </p>
        </div>
      </PageContainer>
    </div>
  );
}
