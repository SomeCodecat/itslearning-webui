"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR, { mutate } from "swr";
import {
  Check,
  ChevronDown,
  Clock,
  LogOut,
  Loader2,
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
    `text-sm transition-colors ${
      isActive(href)
        ? "font-bold text-indigo-300"
        : "font-medium text-slate-400 hover:text-indigo-300"
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
      // Revalidate all /api/tasks and /api/files cache entries (handles query-string variants)
      await mutate((key) => typeof key === "string" && key.startsWith("/api/tasks"));
      await mutate((key) => typeof key === "string" && key.startsWith("/api/files"));
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

  const syncText = (() => {
    if (syncStatus === "syncing") return navT("syncing");
    if (syncStatus === "success") return navT("synced");
    if (syncStatus === "error") return navT("failed");
    if (syncStatus === "rate_limited") {
      return navT("waitSeconds", { seconds: retryAfter });
    }

    return lastSyncedText
      ? navT("syncedRelative", { relative: lastSyncedText })
      : navT("notSynced");
  })();

  const syncStateClasses = {
    idle: {
      label: "text-slate-500",
      button: "bg-slate-800 text-slate-400 hover:text-indigo-300",
      icon: <RefreshCw size={18} />,
    },
    syncing: {
      label: "text-indigo-300",
      button: "bg-indigo-500/14 text-indigo-300",
      icon: <Loader2 size={18} className="animate-spin" />,
    },
    success: {
      label: "font-semibold text-emerald-400",
      button: "bg-emerald-500/14 text-emerald-400",
      icon: <Check size={18} strokeWidth={2.6} />,
    },
    error: {
      label: "font-semibold text-red-400",
      button: "bg-red-500/14 text-red-400",
      icon: <X size={18} />,
    },
    rate_limited: {
      label: "font-mono font-bold text-orange-400",
      button: "cursor-not-allowed bg-orange-500/14 text-orange-400",
      icon: <Clock size={18} />,
    },
  }[syncStatus];

  return (
    <header className="border-b border-slate-800 bg-[#0b1120]">
      <PageContainer>
        <nav className="py-3.5" aria-label={navT("mainMenu")}>
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <button
                ref={mobileMenuButtonRef}
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:text-indigo-300 md:hidden"
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

            <div className="flex items-center gap-3 sm:gap-3.5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden text-right sm:block">
                  <div className={`text-xs font-medium ${syncStateClasses.label}`}>
                    {syncText}
                  </div>
                </div>

                <button
                  onClick={handleSync}
                  disabled={
                    syncStatus === "syncing" || syncStatus === "rate_limited"
                  }
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${syncStateClasses.button}`}
                  title={navT("syncTitle")}
                  aria-label={navT("syncTitle")}
                >
                  {syncStateClasses.icon}
                </button>
              </div>

              <NotificationBell />

              {/* User Dropdown */}
              <div className="relative border-l border-slate-800 pl-3" ref={menuRef}>
                <button
                  ref={userMenuButtonRef}
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 rounded-[10px] py-1 text-slate-100 transition-colors hover:text-indigo-300 focus:outline-none"
                  aria-label={navT("userMenuLabel")}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-controls={userMenuId}
                >
                  <div className="hidden text-right sm:block">
                    <div className="text-[13px] font-semibold text-slate-100">
                      {isLoading ? (
                        <div className="h-4 w-20 animate-pulse rounded bg-slate-800" />
                      ) : (
                        user?.firstName || navT("userFallback")
                      )}
                    </div>
                  </div>
                  <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-indigo-500/14 text-indigo-300">
                    <User size={16} />
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-slate-500 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div
                    id={userMenuId}
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-56 animate-in rounded-xl border border-slate-700 bg-slate-900 py-2 shadow-popover fade-in zoom-in-95 duration-200"
                  >
                    <div className="border-b border-slate-800 px-4 py-3">
                      <p className="text-sm font-medium text-slate-100">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user?.email}
                      </p>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                        role="menuitem"
                      >
                        <Settings size={16} />
                        {t("settings")}
                      </Link>
                    </div>

                    <div className="border-t border-slate-800 py-1">
                      <button
                        onClick={async () => {
                          await fetch("/api/auth/logout", { method: "POST" });
                          window.location.href = "/";
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/14"
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
              className="mt-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-card md:hidden"
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
