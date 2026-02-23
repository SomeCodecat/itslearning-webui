"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR, { mutate } from "swr";
import {
  ChevronDown,
  Loader2,
  LogOut,
  Settings,
  User,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export function Navigation() {
  const t = useTranslations("Index");
  const pathname = usePathname();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => pathname.includes(path);

  // Fetch current user
  const { data: user, isLoading } = useSWR("/api/user", (url) =>
    fetch(url).then((res) => res.json()),
  );

  // --- Sync Logic ---
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "success" | "error" | "rate_limited"
  >("idle");
  const [retryAfter, setRetryAfter] = useState(0);
  const [lastSyncedText, setLastSyncedText] = useState("");

  // Calculate relative time string
  const updateRelativeTime = useCallback(() => {
    if (!user?.lastSyncedAt) {
      setLastSyncedText("");
      return;
    }
    const date = new Date(user.lastSyncedAt);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const diffInMins = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMins / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 30) setLastSyncedText("Just now");
    else if (diffInMins < 1) setLastSyncedText("< 1 min ago");
    else if (diffInMins === 1) setLastSyncedText("1 min ago");
    else if (diffInMins < 60) setLastSyncedText(`${diffInMins} mins ago`);
    else if (diffInHours === 1) setLastSyncedText("1 hour ago");
    else if (diffInHours < 24) setLastSyncedText(`${diffInHours} hours ago`);
    else if (diffInDays === 1) setLastSyncedText("Yesterday");
    else setLastSyncedText(`${diffInDays} days ago`);
  }, [user?.lastSyncedAt]);

  // Update time every minute
  useEffect(() => {
    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 60000);
    return () => clearInterval(interval);
  }, [updateRelativeTime]);

  const handleSync = async () => {
    if (syncStatus === "syncing" || syncStatus === "rate_limited") return;

    setSyncStatus("syncing");
    try {
      const res = await fetch("/api/sync", { method: "POST" });

      if (res.status === 429) {
        const data = await res.json();
        setSyncStatus("rate_limited");
        setRetryAfter(data.retryAfter || 30);
        return;
      }

      if (!res.ok) throw new Error("Sync failed");

      await mutate("/api/user"); // Refresh lastSyncedAt
      await mutate("/api/courses");
      await mutate("/api/tasks");

      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (error) {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  };

  // Countdown timer for Rate Limit
  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setInterval(() => {
        setRetryAfter((prev) => {
          if (prev <= 1) {
            setSyncStatus("idle");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [retryAfter]);

  // Auto-Sync (Every 5 minutes)
  useEffect(() => {
    const interval = setInterval(
      () => {
        handleSync();
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="flex gap-6 pb-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex gap-6 items-center">
          <Link
            href="/dashboard"
            className={`text-sm font-medium transition-colors ${isActive("/dashboard") ? "text-blue-600 font-bold" : "text-gray-700 dark:text-gray-300 hover:text-blue-600"}`}
          >
            {t("dashboard")}
          </Link>
          <Link
            href="/courses"
            className={`text-sm font-medium transition-colors ${isActive("/courses") ? "text-blue-600 font-bold" : "text-gray-700 dark:text-gray-300 hover:text-blue-600"}`}
          >
            {t("courses")}
          </Link>
          <Link
            href="/files"
            className={`text-sm font-medium transition-colors ${isActive("/files") ? "text-blue-600 font-bold" : "text-gray-700 dark:text-gray-300 hover:text-blue-600"}`}
          >
            {t("files")}
          </Link>
          <Link
            href="/tasks"
            className={`text-sm font-medium transition-colors ${isActive("/tasks") ? "text-blue-600 font-bold" : "text-gray-700 dark:text-gray-300 hover:text-blue-600"}`}
          >
            {t("tasks")}
          </Link>
        </div>

        <div className="flex items-center">
          {/* Sync Section */}
          <div className="flex items-center gap-3 pr-6 border-r border-gray-200 dark:border-gray-700 mr-6">
            <div className="text-right hidden sm:block">
              <div
                className={`text-xs font-medium ${syncStatus === "rate_limited" ? "text-orange-500 font-bold" : "text-gray-500"}`}
              >
                {syncStatus === "syncing" && "Syncing..."}
                {syncStatus === "success" && "Synced!"}
                {syncStatus === "error" && "Failed"}
                {syncStatus === "rate_limited" && `Wait ${retryAfter}s`}
                {syncStatus === "idle" &&
                  (lastSyncedText ? `Synced ${lastSyncedText}` : "Not synced")}
              </div>
            </div>

            <button
              onClick={handleSync}
              disabled={
                syncStatus === "syncing" || syncStatus === "rate_limited"
              }
              className={`p-2 rounded-full transition-colors ${
                syncStatus === "rate_limited"
                  ? "bg-orange-100 text-orange-600 cursor-not-allowed"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-blue-600"
              }`}
              title="Sync with school"
            >
              <RefreshCw
                size={18}
                className={
                  syncStatus === "syncing" ? "animate-spin text-blue-600" : ""
                }
              />
            </button>
          </div>

          {/* User Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 pl-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus:outline-none"
            >
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {isLoading ? (
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
                  ) : (
                    user?.firstName || "User"
                  )}
                </div>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-full text-blue-600 dark:text-blue-400">
                <User size={18} />
              </div>
              <ChevronDown
                size={14}
                className={`text-gray-500 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <Settings size={16} />
                    {t("settings")}
                  </Link>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                  <button
                    onClick={async () => {
                      await fetch("/api/auth/logout", { method: "POST" });
                      window.location.href = "/";
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-left"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
