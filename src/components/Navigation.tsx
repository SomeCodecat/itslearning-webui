"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR, { mutate } from "swr";
import {
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  User,
  RefreshCw,
  X,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { PageContainer } from "./PageContainer";

export function Navigation() {
  const t = useTranslations("Index");
  const navT = useTranslations("Navigation");
  const relativeT = useTranslations("RelativeTime");
  const pathname = usePathname();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuId = "mobile-navigation-menu";
  const userMenuId = "user-navigation-menu";

  const isActive = (path: string) => pathname.includes(path);
  const navLinks = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/courses", label: t("courses") },
    { href: "/files", label: t("files") },
    { href: "/tasks", label: t("tasks") },
    { href: "/grades", label: t("grades") },
    { href: "/calendar", label: t("calendar") },
  ];
  const linkClassName = (href: string) =>
    `text-sm font-medium transition-colors ${
      isActive(href)
        ? "text-blue-600 dark:text-blue-400 font-bold"
        : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
    }`;

  // Hide app chrome on unauthenticated screens (paths like /en/login, /de/login).
  // Must not early-return here: all hooks below still have to run on every render.
  const unauthPaths = ["/login", "/setup"];
  const hideChrome = unauthPaths.some((p) => pathname.includes(p));

  // Fetch current user (skipped while on unauthenticated screens)
  const { data: user, isLoading } = useSWR(hideChrome ? null : "/api/user", (url) =>
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

    if (diffInSeconds < 30) setLastSyncedText(relativeT("justNow"));
    else if (diffInMins < 1) setLastSyncedText(relativeT("lessThanMinuteAgo"));
    else if (diffInMins < 60) {
      setLastSyncedText(relativeT("minutesAgo", { count: diffInMins }));
    } else if (diffInHours < 24) {
      setLastSyncedText(relativeT("hoursAgo", { count: diffInHours }));
    } else if (diffInDays === 1) setLastSyncedText(relativeT("yesterday"));
    else setLastSyncedText(relativeT("daysAgo", { count: diffInDays }));
  }, [relativeT, user?.lastSyncedAt]);

  // Update time every minute
  useEffect(() => {
    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 60000);
    return () => clearInterval(interval);
  }, [updateRelativeTime]);

  const handleSync = useCallback(async () => {
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
      await mutate("/api/grades");

      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  }, [syncStatus]);

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

  // Auto-Sync (Every 5 minutes) — not while on unauthenticated screens
  useEffect(() => {
    if (hideChrome) return;
    const interval = setInterval(
      () => {
        handleSync();
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [handleSync, hideChrome]);

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }

      if (isUserMenuOpen) {
        setIsUserMenuOpen(false);
        userMenuButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen, isUserMenuOpen]);

  if (hideChrome) return null;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <PageContainer className="pt-4">
        <nav className="pb-4" aria-label={navT("mainMenu")}>
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <button
                ref={mobileMenuButtonRef}
                type="button"
                className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={
                  isMobileMenuOpen ? navT("closeMenu") : navT("openMenu")
                }
                aria-expanded={isMobileMenuOpen}
                aria-controls={mobileMenuId}
                onClick={() => setIsMobileMenuOpen((current) => !current)}
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div className="hidden md:flex gap-6 items-center">
                {navLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={linkClassName(item.href)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center">
          {/* Sync Section */}
          <div className="flex items-center gap-2 sm:gap-3 pr-3 sm:pr-6 border-r border-gray-200 dark:border-gray-700 mr-3 sm:mr-6">
            <div className="text-right hidden sm:block">
              <div
                className={`text-xs font-medium ${syncStatus === "rate_limited" ? "text-orange-500 font-bold" : "text-gray-500"}`}
              >
                {syncStatus === "syncing" && navT("syncing")}
                {syncStatus === "success" && navT("synced")}
                {syncStatus === "error" && navT("failed")}
                {syncStatus === "rate_limited" &&
                  navT("waitSeconds", { seconds: retryAfter })}
                {syncStatus === "idle" &&
                  (lastSyncedText
                    ? navT("syncedRelative", { relative: lastSyncedText })
                    : navT("notSynced"))}
              </div>
            </div>

            <button
              onClick={handleSync}
              disabled={
                syncStatus === "syncing" || syncStatus === "rate_limited"
              }
              className={`p-2 rounded-full transition-colors ${
                syncStatus === "rate_limited"
                  ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 cursor-not-allowed"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
              }`}
              title={navT("syncTitle")}
              aria-label={navT("syncTitle")}
            >
              <RefreshCw
                size={18}
                className={
                  syncStatus === "syncing" ? "animate-spin text-blue-600" : ""
                }
              />
            </button>
          </div>

          <NotificationBell />

          {/* User Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              ref={userMenuButtonRef}
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 pl-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus:outline-none"
              aria-label={navT("userMenuLabel")}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              aria-controls={userMenuId}
            >
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {isLoading ? (
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
                  ) : (
                    user?.firstName || navT("userFallback")
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
              <div
                id={userMenuId}
                role="menu"
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-200"
              >
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
                    role="menuitem"
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
                    role="menuitem"
                  >
                    <LogOut size={16} />
                    {navT("logout")}
                  </button>
                </div>
              </div>
            )}
          </div>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div
              id={mobileMenuId}
              className="md:hidden mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
            >
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-3 ${linkClassName(item.href)}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>
      </PageContainer>
    </header>
  );
}
