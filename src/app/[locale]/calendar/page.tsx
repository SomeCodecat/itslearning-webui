"use client";

import { useFormatter, useTranslations } from "next-intl";
import useSWR from "swr";
import { PageContainer } from "@/components/PageContainer";
import { Download } from "lucide-react";
import { buildIcs } from "@/lib/exportIcs";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type CalendarEvent = {
  EventId: number | string;
  Title: string;
  Description?: string | null;
  From: string;
  To: string;
};

export default function CalendarPage() {
  const t = useTranslations("Calendar");
  const format = useFormatter();
  const {
    data: events,
    error,
    isLoading,
  } = useSWR<CalendarEvent[]>("/api/calendar", fetcher);

  const handleExportIcs = () => {
    if (!events) return;

    const icsEvents = events.map((event) => ({
      id: event.EventId,
      title: event.Title,
      description: event.Description,
      from: event.From,
      to: event.To,
    }));

    const icsContent = buildIcs(icsEvents);
    const dateString = new Date().toISOString().split("T")[0];
    const filename = `calendar-${dateString}.ics`;

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageContainer className="py-6 md:py-10">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t("title")}
            </h1>
          </div>
          <button
            onClick={handleExportIcs}
            disabled={!events || events.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t("exportAriaLabel")}
          >
            <Download size={16} />
            <span>{t("exportLabel")}</span>
          </button>
        </header>

        {isLoading && <div className="text-gray-500">{t("loading")}</div>}
        {error && (
          <div className="text-red-500 dark:text-red-400">
            {t("loadFailed")}
          </div>
        )}

        <div className="space-y-4">
          {Array.isArray(events) &&
            events.map((event) => (
              <div
                key={event.EventId}
                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-l-4 border-l-blue-500 border-gray-200 dark:border-gray-700"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {event.Title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {event.Description}
                </p>
                <div className="mt-2 text-xs text-gray-400">
                  {format.dateTime(new Date(event.From), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  -{" "}
                  {format.dateTime(new Date(event.To), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </div>
            ))}
          {!isLoading && !error && (!Array.isArray(events) || events.length === 0) && (
            <p className="text-gray-500 text-center">{t("empty")}</p>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
