"use client";

import { useFormatter, useTranslations } from "next-intl";
import useSWR from "swr";
import { PageContainer } from "@/components/PageContainer";
import { CalendarDays, Download } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { buildIcs } from "@/lib/exportIcs";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type CalendarEvent = {
  EventId: number | string;
  Title: string;
  Description?: string | null;
  From: string;
  To: string;
};

function getEventDotClass(event: CalendarEvent): string {
  const text = `${event.Title} ${event.Description ?? ""}`.toLowerCase();

  if (text.includes("exam") || text.includes("prüfung") || text.includes("ap1") || text.includes("ap2")) {
    return "bg-error";
  }

  if (text.includes("due") || text.includes("abgabe") || text.includes("deadline")) {
    return "bg-warning";
  }

  return "bg-accent";
}

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
    <div className="min-h-screen bg-background text-foreground">
      <PageContainer className="px-4 py-4 md:px-10 md:py-6">
        <header className="mb-[18px] flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary md:text-2xl">
              {t("title")}
            </h1>
          </div>
          <button
            onClick={handleExportIcs}
            disabled={!events || events.length === 0}
            className="flex items-center gap-1.5 rounded-control border border-line-strong bg-elevated px-3 py-[7px] text-xs font-semibold text-text-secondary transition-colors hover:bg-elevated-strong disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t("exportAriaLabel")}
          >
            <Download size={13} />
            <span>{t("exportLabel")}</span>
          </button>
        </header>

        {isLoading && <LoadingState label={t("loading")} />}
        {error && (
          <ErrorState message={t("loadFailed")} />
        )}

        <div className="flex flex-col gap-2.5">
          {Array.isArray(events) &&
            events.map((event) => {
              const from = new Date(event.From);
              const to = new Date(event.To);

              return (
                <article
                  key={event.EventId}
                  className="flex items-center gap-3.5 rounded-card border border-line bg-card px-[15px] py-[13px]"
                >
                  <div className="w-[46px] flex-none text-center">
                    <div className="font-mono text-xl font-bold leading-none text-accent-text">
                      {format.dateTime(from, { day: "2-digit" })}
                    </div>
                    <div className="font-mono text-[10px] font-semibold uppercase text-text-tertiary">
                      {format.dateTime(from, { month: "short" })}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-text-primary">
                      {event.Title}
                    </h3>
                    <p className="truncate text-[11px] font-medium text-text-tertiary">
                      {[event.Description, `${format.dateTime(from, { timeStyle: "short" })}-${format.dateTime(to, { timeStyle: "short" })}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className={`h-[9px] w-[9px] flex-none rounded-[3px] ${getEventDotClass(event)}`}
                  />
                </article>
              );
            })}
          {!isLoading && !error && (!Array.isArray(events) || events.length === 0) && (
            <EmptyState icon={<CalendarDays size={20} />} title={t("empty")} />
          )}
        </div>
      </PageContainer>
    </div>
  );
}
