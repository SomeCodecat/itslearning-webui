import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SWRConfig } from "swr";

const mockFetch = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      NotificationBell: {
        ariaLabel: "Notifications",
        title: "Notifications",
        unreadSummary: "{unread}/{total} unread",
        countTitle: "{unread} unread of {total} notifications",
        loading: "Loading notifications...",
        error: "Failed to load notifications.",
        empty: "No recent notifications.",
        fallback: "Notification",
      },
      RelativeTime: {
        justNow: "Just now",
        lessThanMinuteAgo: "< 1 min ago",
        minutesAgo: "{count} mins ago",
        hoursAgo: "{count} hours ago",
        yesterday: "Yesterday",
        daysAgo: "{count} days ago",
      },
    };

    return (key: string, values?: Record<string, number>) => {
      if (namespace === "RelativeTime" && values?.count === 1) {
        if (key === "minutesAgo") return "1 min ago";
        if (key === "hoursAgo") return "1 hour ago";
        if (key === "daysAgo") return "1 day ago";
      }

      return (messages[namespace]?.[key] ?? key).replace(
        /\{(\w+)\}/g,
        (_, name) => String(values?.[name] ?? `{${name}}`),
      );
    };
  },
}));

import { NotificationBell } from "../NotificationBell";

function renderWithSWR() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <NotificationBell />
    </SWRConfig>,
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    const now = Date.now();
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            NotificationId: 1,
            Text: "New assignment feedback",
            PublishedDate: new Date(now - 60 * 60 * 1000).toISOString(),
            IsRead: false,
            ContentUrl: "https://school.example/feedback",
          },
          {
            NotificationId: 2,
            Text: "Course bulletin",
            PublishedDate: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
            IsRead: true,
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

  it("shows unread and total counts, then lists recent notifications", async () => {
    renderWithSWR();

    await waitFor(() => {
      expect(screen.getByText("1/2")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("New assignment feedback")).toBeDefined();
    expect(screen.getByText("Course bulletin")).toBeDefined();
    expect(screen.getByText("1 hour ago")).toBeDefined();
    expect(screen.getByText("2 days ago")).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: /New assignment feedback/ })
        .getAttribute("href"),
    ).toBe("https://school.example/feedback");
  });
});
