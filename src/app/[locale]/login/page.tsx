import { getTranslations } from "next-intl/server";
import { BookOpen } from "lucide-react";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const t = await getTranslations("Login");
  const organizationName = process.env.ORGANIZATION_NAME;
  const defaultInstance =
    process.env.DEFAULT_INSTANCE_URL || "https://sdu.itslearning.com";
  const allowCustom = process.env.ALLOW_CUSTOM_INSTANCE !== "false";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex min-h-[440px] w-full max-w-[400px] flex-col items-center justify-center rounded-card border border-line-strong bg-background px-8 py-11 shadow-panel sm:px-10">
        <div className="mb-6 flex w-full flex-col items-center text-center">
          <div className="mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-card bg-accent text-white">
            <BookOpen aria-hidden="true" size={26} strokeWidth={2.2} />
          </div>
          <h1 className="mb-2 text-[22px] font-bold leading-tight text-text-primary">
            {organizationName
              ? t("signInTo", { organization: organizationName })
              : t("signIn")}
          </h1>
          <p className="max-w-full truncate font-mono text-xs font-medium text-text-secondary">
            {defaultInstance}
          </p>
        </div>
        <LoginForm
          defaultInstance={defaultInstance}
          allowCustom={allowCustom}
        />
      </div>
    </div>
  );
}
