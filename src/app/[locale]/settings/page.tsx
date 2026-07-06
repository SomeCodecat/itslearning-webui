"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Save, Loader2, Eye, EyeOff } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { LoadingState } from "@/components/ui/LoadingState";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to load user");
  }

  return data;
};

const fieldClass =
  "w-full rounded-control border border-line-strong bg-elevated px-3 py-[9px] text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "mb-1.5 block text-sm font-medium text-text-secondary";

export default function SettingsPage() {
  const t = useTranslations("Settings");

  const [activeTab, setActiveTab] = useState<"profile" | "school">("profile");

  // --- Profile State ---
  const { data: user, isLoading: userLoading } = useSWR("/api/user", fetcher);

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [profileStatus, setProfileStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [profileMessage, setProfileMessage] = useState("");

  // --- School State ---
  const [schoolForm, setSchoolForm] = useState({
    organizationUrl: "",
    username: "",
    password: "",
  });
  const [schoolStatus, setSchoolStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [schoolMessage, setSchoolMessage] = useState("");
  const [showSchoolPassword, setShowSchoolPassword] = useState(false);

  // Populate form on user load
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
      // Also pre-fill school settings if available
      setSchoolForm((prev) => ({
        ...prev,
        organizationUrl: user.itslearningUrl || "",
        username: user.itslearningUser || "",
      }));
    }
  }, [user]);

  // --- Handlers ---

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus("saving");
    setProfileMessage("");
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("profileUpdateFailed"));

      await mutate("/api/user"); // Refresh local data
      setProfileStatus("success");
      setTimeout(() => setProfileStatus("idle"), 2000);
    } catch (err: unknown) {
      setProfileStatus("error");
      setProfileMessage(err instanceof Error ? err.message : t("saveFailed"));
    }
  };

  const handleSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSchoolStatus("loading");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schoolForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("authenticationFailed"));

      setSchoolStatus("success");
      setSchoolMessage(t("connectedSuccessfully"));
      // Trigger user revalidation so header updates
      await mutate("/api/user");
    } catch (err: unknown) {
      setSchoolStatus("error");
      setSchoolMessage(
        err instanceof Error ? err.message : t("authenticationFailed"),
      );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-6 py-6 md:px-10">
        <header className="mb-[18px]">
          <h1 className="mb-1 text-xl font-bold text-text-primary md:text-2xl">
            {t("title")}
          </h1>
          <p className="text-sm text-text-secondary">
            {t("subtitle")}
          </p>
        </header>

        <div>
          {/* Segmented Navigation */}
          <div className="mb-5 flex w-fit gap-1.5 rounded-control bg-elevated p-1">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`rounded-[7px] px-4 py-[7px] text-[13px] transition-colors ${
                activeTab === "profile"
                  ? "bg-card text-accent-text shadow-card font-semibold"
                  : "text-text-secondary hover:text-text-primary font-medium"
              }`}
            >
              {t("profile")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("school")}
              className={`rounded-[7px] px-4 py-[7px] text-[13px] transition-colors ${
                activeTab === "school"
                  ? "bg-card text-accent-text shadow-card font-semibold"
                  : "text-text-secondary hover:text-text-primary font-medium"
              }`}
            >
              {t("schoolConnection")}
            </button>
          </div>

          {/* Main Content Area */}
          <div>
            {activeTab === "profile" && (
              <div className="animate-in fade-in flex flex-col rounded-card border border-line bg-card p-[22px] duration-300">
                <h2 className="mb-[18px] text-sm font-semibold text-text-primary">
                  {t("personalInformation")}
                </h2>

                {userLoading ? (
                  <LoadingState label={t("loadingProfile")} />
                ) : (
                  <form
                    onSubmit={handleProfileSubmit}
                    className="max-w-2xl space-y-5"
                  >
                    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                      <div>
                        <label htmlFor="settings-first-name" className={labelClass}>
                          {t("firstName")}
                        </label>
                        <input
                          id="settings-first-name"
                          type="text"
                          disabled={profileStatus === "saving"}
                          autoComplete="given-name"
                          value={profileForm.firstName}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              firstName: e.target.value,
                            })
                          }
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="settings-last-name" className={labelClass}>
                          {t("lastName")}
                        </label>
                        <input
                          id="settings-last-name"
                          type="text"
                          disabled={profileStatus === "saving"}
                          autoComplete="family-name"
                          value={profileForm.lastName}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              lastName: e.target.value,
                            })
                          }
                          className={fieldClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="settings-email" className={labelClass}>
                        {t("email")}
                      </label>
                      <input
                        id="settings-email"
                        type="email"
                        disabled={profileStatus === "saving"}
                        autoComplete="email"
                        value={profileForm.email}
                        onChange={(e) =>
                          setProfileForm({
                            ...profileForm,
                            email: e.target.value,
                          })
                        }
                        className={fieldClass}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={profileStatus === "saving"}
                        className="flex items-center gap-2 rounded-control bg-accent px-[18px] py-[9px] text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {profileStatus === "saving" ? (
                          <Loader2 className="animate-spin" size={14} />
                        ) : (
                          <Save size={14} />
                        )}
                        {profileStatus === "saving"
                          ? t("saving")
                          : t("saveChanges")}
                      </button>
                      {profileStatus === "success" && (
                        <span className="text-sm font-medium text-success">
                          {t("saved")}
                        </span>
                      )}
                      {profileStatus === "error" && (
                        <span className="text-sm font-medium text-error">
                          {profileMessage || t("saveFailed")}
                        </span>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            {activeTab === "school" && (
              <div className="animate-in fade-in flex flex-col rounded-card border border-line bg-card p-[22px] duration-300">
                <h2 className="mb-[18px] text-sm font-semibold text-text-primary">
                  {t("connectItslearning")}
                </h2>

                {userLoading ? (
                  <LoadingState label={t("loadingProfile")} />
                ) : (
                  <form
                    onSubmit={handleSchoolSubmit}
                    className="max-w-2xl space-y-5"
                  >
                    <div>
                      <label htmlFor="settings-itslearning-url" className={labelClass}>
                        {t("itslearningUrl")}
                      </label>
                      <input
                        id="settings-itslearning-url"
                        type="url"
                        required
                        disabled={schoolStatus === "loading"}
                        autoComplete="url"
                        className={fieldClass}
                        placeholder="https://sso.itslearning.com"
                        value={schoolForm.organizationUrl}
                        onChange={(e) =>
                          setSchoolForm({
                            ...schoolForm,
                            organizationUrl: e.target.value,
                          })
                        }
                      />
                      <p className="mt-1 text-xs text-text-tertiary">
                        {t("organizationUrlHint")}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="settings-username" className={labelClass}>
                        {t("username")}
                      </label>
                      <input
                        id="settings-username"
                        type="text"
                        required
                        disabled={schoolStatus === "loading"}
                        autoComplete="username"
                        className={fieldClass}
                        value={schoolForm.username}
                        onChange={(e) =>
                          setSchoolForm({
                            ...schoolForm,
                            username: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label htmlFor="settings-password" className={labelClass}>
                        {t("password")}
                      </label>
                      <div className="relative">
                        <input
                          id="settings-password"
                          type={showSchoolPassword ? "text" : "password"}
                          required
                          disabled={schoolStatus === "loading"}
                          autoComplete="current-password"
                          className={`${fieldClass} pr-10`}
                          value={schoolForm.password}
                          onChange={(e) =>
                            setSchoolForm({
                              ...schoolForm,
                              password: e.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowSchoolPassword(!showSchoolPassword)}
                          aria-label={showSchoolPassword ? t("hidePassword") : t("showPassword")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-text-secondary focus:outline-none"
                        >
                          {showSchoolPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {schoolStatus === "error" && (
                      <div className="rounded-control border border-error/30 bg-error-subtle p-3 text-sm text-error">
                        {schoolMessage}
                      </div>
                    )}
                    {schoolStatus === "success" && (
                      <div className="rounded-control border border-success/30 bg-success-subtle p-3 text-sm text-success">
                        {schoolMessage}
                      </div>
                    )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={schoolStatus === "loading"}
                      className="rounded-control bg-accent px-[18px] py-[9px] text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {schoolStatus === "loading"
                        ? t("connecting")
                        : t("saveAndConnect")}
                    </button>
                  </div>
                </form>
                )}

                <div className="mt-8 border-t border-line pt-6">
                  <h3 className="mb-2 text-sm font-medium text-text-primary">
                    {t("environment")}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {t("externalUrl")}{" "}
                    <code className="rounded bg-elevated px-1 py-0.5 font-mono text-text-tertiary">
                      {process.env.NEXT_PUBLIC_EXTERNAL_URL || t("notSet")}
                    </code>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
