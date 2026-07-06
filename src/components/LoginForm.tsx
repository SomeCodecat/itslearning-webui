"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { mutate } from "swr";
import { Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);

  const inputClassName =
    "relative block w-full appearance-none rounded-control border border-line-strong bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors focus:border-accent focus:ring-3 focus:ring-accent-subtle disabled:cursor-not-allowed disabled:opacity-60";
  const labelClassName =
    "mb-1.5 block text-sm font-medium text-text-secondary";

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
    <form className="w-full space-y-5" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-control border border-error/50 bg-error-subtle px-3 py-2.5 text-center text-sm font-medium text-error">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="email-address" className={labelClassName}>
            {t("usernameLabel")}
          </label>
          <input
            id="email-address"
            name="email"
            type="text"
            autoComplete="username"
            required
            disabled={loading}
            className={inputClassName}
            placeholder={t("usernamePlaceholder")}
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClassName}>
            {t("passwordLabel")}
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={loading}
              className={`${inputClassName} pr-10`}
              placeholder={t("passwordPlaceholder")}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-accent-text focus:outline-none"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {allowCustom && (
          <div>
            <label htmlFor="organization-url" className={labelClassName}>
              {t("institutionUrlLabel")}
            </label>
            <input
              id="organization-url"
              name="organizationUrl"
              type="url"
              autoComplete="url"
              required
              disabled={loading}
              className={inputClassName}
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
          className="relative mt-1.5 flex w-full justify-center rounded-control bg-accent px-4 py-[11px] text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </div>
    </form>
  );
}
