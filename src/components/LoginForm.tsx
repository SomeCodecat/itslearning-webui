"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { mutate } from "swr";

interface LoginFormProps {
  defaultInstance?: string;
  allowCustom?: boolean;
}

export default function LoginForm({
  defaultInstance = "https://sdu.itslearning.com",
  allowCustom = true,
}: LoginFormProps) {
  const t = useTranslations("Login");
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    organizationUrl: defaultInstance,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error(t("invalidCredentials"));
      }

      await mutate("/api/user"); // Force revalidation of user session
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm text-center">
          {error}
        </div>
      )}
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <label htmlFor="email-address" className="sr-only">
            {t("usernameLabel")}
          </label>
          <input
            id="email-address"
            name="email"
            type="text"
            autoComplete="username"
            required
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
            placeholder={t("usernamePlaceholder")}
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">
            {t("passwordLabel")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm ${!allowCustom ? "rounded-b-md" : ""}`}
            placeholder={t("passwordPlaceholder")}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />
        </div>
        {allowCustom && (
          <div>
            <label htmlFor="organization-url" className="sr-only">
              {t("institutionUrlLabel")}
            </label>
            <input
              id="organization-url"
              name="organizationUrl"
              type="url"
              required
              className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 text-gray-900 dark:text-white dark:bg-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder={defaultInstance}
              value={formData.organizationUrl}
              onChange={(e) =>
                setFormData({ ...formData, organizationUrl: e.target.value })
              }
            />
          </div>
        )}
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </div>
    </form>
  );
}
