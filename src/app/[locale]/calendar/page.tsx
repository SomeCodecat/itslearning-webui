"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Navigation } from "@/components/Navigation";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CalendarPage() {
  const { data: events, error, isLoading } = useSWR("/api/calendar", fetcher);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <header className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Calendar
          </h1>
          <Navigation />
        </header>

        {isLoading && <div className="text-gray-500">Loading events...</div>}
        {error && <div className="text-red-500">Failed to load events.</div>}

        <div className="space-y-4">
          {Array.isArray(events) &&
            events.map((event: any) => (
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
                  {new Date(event.From).toLocaleString()} -{" "}
                  {new Date(event.To).toLocaleString()}
                </div>
              </div>
            ))}
          {(!Array.isArray(events) || events.length === 0) && (
            <p className="text-gray-500 text-center">No upcoming events.</p>
          )}
        </div>
      </div>
    </div>
  );
}
