import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SWRConfig } from "swr";
import { NotificationBell } from "../NotificationBell";

const mockFetch = vi.fn();

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
