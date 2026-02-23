import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const organizationName = process.env.ORGANIZATION_NAME;
  const defaultInstance =
    process.env.DEFAULT_INSTANCE_URL || "https://sdu.itslearning.com";
  const allowCustom = process.env.ALLOW_CUSTOM_INSTANCE !== "false";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">
            {organizationName ? `Sign in to ${organizationName}` : "Sign in"}
          </h2>
        </div>
        <LoginForm
          defaultInstance={defaultInstance}
          allowCustom={allowCustom}
        />
      </div>
    </div>
  );
}
