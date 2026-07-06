"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { User, School, Save, Loader2, Eye, EyeOff } from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to load user");
  }

  return data;
};

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 space-y-2">
            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "profile"
                  ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <User size={18} />
              {t("profile")}
            </button>
            <button
              onClick={() => setActiveTab("school")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "school"
                  ? "bg-white dark:bg-gray-800 text-blue-600 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <School size={18} />
              {t("schoolConnection")}
            </button>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1">
            {activeTab === "profile" && (
              <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-in fade-in duration-300">
                <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
                  {t("personalInformation")}
                </h2>

                {userLoading ? (
                  <div className="py-10 text-center text-gray-500">
                    <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2 text-blue-500" />
                    {t("loadingProfile")}
                  </div>
                ) : (
                  <form
                    onSubmit={handleProfileSubmit}
                    className="space-y-6 max-w-lg"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="settings-first-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label htmlFor="settings-last-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="settings-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={profileStatus === "saving"}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors disabled:opacity-50"
                      >
                        {profileStatus === "saving" ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <Save size={18} />
                        )}
                        {profileStatus === "saving"
                          ? t("saving")
                          : t("saveChanges")}
                      </button>
                      {profileStatus === "success" && (
                        <span className="ml-3 text-green-600 dark:text-green-400 text-sm font-medium">
                          {t("saved")}
                        </span>
                      )}
                      {profileStatus === "error" && (
                        <span className="ml-3 text-red-600 dark:text-red-400 text-sm font-medium">
                          {profileMessage || t("saveFailed")}
                        </span>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            {activeTab === "school" && (
              <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-in fade-in duration-300">
                <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
                  {t("connectItslearning")}
                </h2>

                {userLoading ? (
                  <div className="py-10 text-center text-gray-500">
                    <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2 text-blue-500" />
                    {t("loadingProfile")}
                  </div>
                ) : (
                  <form
                    onSubmit={handleSchoolSubmit}
                    className="space-y-6 max-w-lg"
                  >
                    <div>
                      <label htmlFor="settings-itslearning-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t("itslearningUrl")}
                      </label>
                      <input
                        id="settings-itslearning-url"
                        type="url"
                        required
                        disabled={schoolStatus === "loading"}
                        autoComplete="url"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        placeholder="https://sso.itslearning.com"
                        value={schoolForm.organizationUrl}
                        onChange={(e) =>
                          setSchoolForm({
                            ...schoolForm,
                            organizationUrl: e.target.value,
                          })
                        }
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {t("organizationUrlHint")}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="settings-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t("username")}
                      </label>
                      <input
                        id="settings-username"
                        type="text"
                        required
                        disabled={schoolStatus === "loading"}
                        autoComplete="username"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                      <label htmlFor="settings-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t("password")}
                      </label>
                      <div className="relative">
                        <input
                          id="settings-password"
                          type={showSchoolPassword ? "text" : "password"}
                          required
                          disabled={schoolStatus === "loading"}
                          autoComplete="current-password"
                          className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
                        >
                          {showSchoolPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {schoolStatus === "error" && (
                      <div className="p-3 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 rounded-md text-sm">
                        {schoolMessage}
                      </div>
                    )}
                    {schoolStatus === "success" && (
                      <div className="p-3 bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 rounded-md text-sm">
                        {schoolMessage}
                      </div>
                    )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={schoolStatus === "loading"}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                    >
                      {schoolStatus === "loading"
                        ? t("connecting")
                        : t("saveAndConnect")}
                    </button>
                  </div>
                </form>
                )}

                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    {t("environment")}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t("externalUrl")}{" "}
                    <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">
                      {process.env.NEXT_PUBLIC_EXTERNAL_URL || t("notSet")}
                    </code>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
