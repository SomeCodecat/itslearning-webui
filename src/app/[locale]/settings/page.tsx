"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import useSWR, { mutate } from "swr";
import { User, School, Save, Loader2 } from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to load user");
  }

  return data;
};

export default function SettingsPage() {
  const t = useTranslations("Index");
  const router = useRouter();

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
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      await mutate("/api/user"); // Refresh local data
      setProfileStatus("success");
      setTimeout(() => setProfileStatus("idle"), 2000);
    } catch (err: any) {
      setProfileStatus("error");
      setProfileMessage(err.message || "Failed to save.");
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
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      setSchoolStatus("success");
      setSchoolMessage("Connected successfully!");
      // Trigger user revalidation so header updates
      await mutate("/api/user");
    } catch (err: any) {
      setSchoolStatus("error");
      setSchoolMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your profile and school connection.
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
              Profile
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
              School Connection
            </button>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1">
            {activeTab === "profile" && (
              <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-in fade-in duration-300">
                <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-4">
                  Personal Information
                </h2>

                {userLoading ? (
                  <div className="py-10 text-center text-gray-500">
                    <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2 text-blue-500" />
                    Loading profile...
                  </div>
                ) : (
                  <form
                    onSubmit={handleProfileSubmit}
                    className="space-y-6 max-w-lg"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.firstName}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              firstName: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.lastName}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              lastName: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) =>
                          setProfileForm({
                            ...profileForm,
                            email: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
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
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                      {profileStatus === "success" && (
                        <span className="ml-3 text-green-600 text-sm font-medium">
                          Saved!
                        </span>
                      )}
                      {profileStatus === "error" && (
                        <span className="ml-3 text-red-600 text-sm font-medium">
                          {profileMessage || "Failed to save."}
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
                  Connect to itslearning
                </h2>

                <form
                  onSubmit={handleSchoolSubmit}
                  className="space-y-6 max-w-lg"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      itslearning URL
                    </label>
                    <input
                      type="url"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
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
                      Is usually your organizations login page.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                      value={schoolForm.password}
                      onChange={(e) =>
                        setSchoolForm({
                          ...schoolForm,
                          password: e.target.value,
                        })
                      }
                    />
                  </div>

                  {schoolStatus === "error" && (
                    <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                      {schoolMessage}
                    </div>
                  )}
                  {schoolStatus === "success" && (
                    <div className="p-3 bg-green-100 text-green-700 rounded-md text-sm">
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
                        ? "Connecting..."
                        : "Save & Connect"}
                    </button>
                  </div>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Environment
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    External URL:{" "}
                    <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">
                      {process.env.NEXT_PUBLIC_EXTERNAL_URL || "Not set"}
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
