import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import CalendarPage from "../page";

const mockFetch = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      title: "Calendar",
      loading: "Loading events...",
      loadFailed: "Failed to load events.",
      empty: "No upcoming events.",
      exportLabel: "Export Calendar",
      exportAriaLabel: "Export calendar events to ICS format",
    };

    return (key: string) => messages[key] ?? key;
  },
  useFormatter: () => ({
    dateTime: (date: Date, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("en-US", options).format(date),
  }),
}));

vi.mock("@/lib/exportIcs", () => ({
  buildIcs: vi.fn(() => "BEGIN:VCALENDAR\nEND:VCALENDAR"),
}));

function renderWithSWR() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CalendarPage />
    </SWRConfig>,
  );
}

describe("CalendarPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            EventId: 10,
            Title: "Datenbank-Übung",
            Description: "Datenbanken",
            From: "2026-07-06T18:00:00.000Z",
            To: "2026-07-06T19:00:00.000Z",
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders tokenized calendar event rows with mono date blocks", async () => {
    const { container } = renderWithSWR();

    await waitFor(() => {
      expect(screen.getByText("Datenbank-Übung")).toBeDefined();
    });

    expect(container.firstElementChild?.className).toContain("bg-background");
    const eventCard = screen.getByText("Datenbank-Übung").closest("article");
    expect(eventCard?.className).toContain("bg-card");
    expect(eventCard?.className).toContain("border-line");

    const day = screen.getByText("06");
    expect(day.className).toContain("font-mono");
    expect(day.className).toContain("text-accent-text");
  });
});
