"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Bell, Loader2 } from "lucide-react";

type NotificationEntity = {
  NotificationId?: number | string;
  Text?: string;
  Message?: string;
  Title?: string;
  Type?: string;
  PublishedDate?: string;
  CreatedDate?: string;
  Date?: string;
  Url?: string;
  ContentUrl?: string;
  IsRead?: boolean;
  PublishedBy?: {
    FullName?: string;
    FirstName?: string;
    LastName?: string;
  };
};

const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Failed to fetch notifications");
  }

  return response.json();
};

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getNotificationText(
  notification: NotificationEntity,
  fallback: string,
): string {
  return stripHtml(
    notification.Text ||
      notification.Message ||
      notification.Title ||
      notification.Type ||
      fallback,
  );
}

function getNotificationDate(notification: NotificationEntity): string | null {
  return (
    notification.PublishedDate || notification.CreatedDate || notification.Date || null
  );
}

function getPublisherName(notification: NotificationEntity): string | null {
  const publisher = notification.PublishedBy;

  if (!publisher) {
    return null;
  }

  if (publisher.FullName) {
    return publisher.FullName;
  }

  return [publisher.FirstName, publisher.LastName].filter(Boolean).join(" ") || null;
}

function getNotificationUrl(notification: NotificationEntity): string | null {
  return notification.ContentUrl || notification.Url || null;
}

function relativeTime(
  value: string | null,
  t: ReturnType<typeof useTranslations>,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return "";
  }

  const diffInSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 30) return t("justNow");
  if (diffInMinutes < 1) return t("lessThanMinuteAgo");
  if (diffInMinutes < 60) return t("minutesAgo", { count: diffInMinutes });
  if (diffInHours < 24) return t("hoursAgo", { count: diffInHours });
  if (diffInDays === 1) return t("yesterday");

  return t("daysAgo", { count: diffInDays });
}

function getNotificationKey(
  notification: NotificationEntity,
  index: number,
  fallback: string,
) {
  return notification.NotificationId ?? `${getNotificationText(notification, fallback)}-${index}`;
}

export function NotificationBell() {
  const t = useTranslations("NotificationBell");
  const relativeT = useTranslations("RelativeTime");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);
  const {
    data: notifications,
    error,
    isLoading,
  } = useSWR<NotificationEntity[]>("/api/notifications", fetcher, {
    refreshInterval: 60000,
  });

  const items = useMemo(
    () => (Array.isArray(notifications) ? notifications : []),
    [notifications],
  );
  const recentItems = useMemo(() => items.slice(0, 8), [items]);
  const unreadCount = items.filter((notification) => notification.IsRead === false).length;
  const totalCount = items.length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-slate-400 transition-colors hover:bg-slate-800 hover:text-indigo-300 focus:outline-none"
        aria-label={t("ariaLabel")}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Bell size={18} />
        {totalCount > 0 && (
          <span title={t("countTitle", { unread: unreadCount, total: totalCount })}>
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-[5px] top-[5px] h-2 w-2 rounded-full bg-red-400 ring-2 ring-bar"
              />
            )}
            <span className="sr-only">
              {unreadCount}/{totalCount}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-in rounded-xl border border-slate-700 bg-slate-900 py-2 shadow-popover fade-in zoom-in-95 duration-200">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100">
                {t("title")}
              </p>
              <p className="text-xs font-medium text-slate-500">
                {t("unreadSummary", { unread: unreadCount, total: totalCount })}
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin text-indigo-300" />
              {t("loading")}
            </div>
          )}

          {error && (
            <div className="px-4 py-4 text-sm font-medium text-red-400">
              {t("error")}
            </div>
          )}

          {!isLoading && !error && recentItems.length === 0 && (
            <div className="px-4 py-4 text-sm text-slate-500">
              {t("empty")}
            </div>
          )}

          {!isLoading && !error && recentItems.length > 0 && (
            <div className="max-h-96 overflow-y-auto py-1">
              {recentItems.map((notification, index) => {
                const url = getNotificationUrl(notification);
                const notificationText = getNotificationText(
                  notification,
                  t("fallback"),
                );
                const notificationTime = relativeTime(
                  getNotificationDate(notification),
                  relativeT,
                );
                const content = (
                  <>
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                          notification.IsRead === false
                            ? "bg-indigo-500"
                            : "bg-slate-700"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm text-slate-100">
                          {notificationText}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                          {getPublisherName(notification) && (
                            <span>{getPublisherName(notification)}</span>
                          )}
                          {notificationTime && <span>{notificationTime}</span>}
                        </div>
                      </div>
                    </div>
                  </>
                );

                if (url) {
                  return (
                    <a
                      key={getNotificationKey(notification, index, t("fallback"))}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-3 hover:bg-slate-800"
                      onClick={() => setIsOpen(false)}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <div
                    key={getNotificationKey(notification, index, t("fallback"))}
                    className="px-4 py-3"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
