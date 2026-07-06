import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SWRConfig } from "swr";
import TasksPage from "../page";

const mockFetch = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

function renderWithSWR() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <TasksPage />
    </SWRConfig>,
  );
}

describe("TasksPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/tasks?status=Active") {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 7,
                TaskId: 12345,
                Title: "Essay",
                Status: "Active",
                Deadline: "2026-07-10T09:00:00.000Z",
                Url: "https://school.example/task",
                CourseTitle: "English",
              },
            ]),
            { status: 200 },
          ),
        );
      }

      if (url === "/api/tasks/7") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 7,
              elementId: 12345,
              title: "Essay",
              status: "Active",
              deadline: "2026-07-10T09:00:00.000Z",
              webUrl: "https://school.example/task",
              course: { title: "English" },
              details: {
                StatusScale: {
                  Title: "Submission status",
                  StatusItems: [
                    {
                      AssessmentStatusItemId: 1,
                      Title: "Submitted",
                      IsSubmitted: true,
                    },
                  ],
                },
                AssessmentScale: {
                  Title: "Grade scale",
                  AssessmentItems: [
                    {
                      AssessmentItemId: 2,
                      Title: "A",
                      PercentFromAndIncl: 90,
                      PercentTo: 100,
                    },
                  ],
                },
              },
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lazy-loads assignment details when a task is opened", async () => {
    renderWithSWR();

    await waitFor(() => {
      expect(screen.getByText("Essay")).toBeDefined();
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks?status=Active");
    expect(mockFetch).not.toHaveBeenCalledWith("/api/tasks/7");

    fireEvent.click(screen.getByRole("button", { name: /Essay/ }));

    await waitFor(() => {
      expect(screen.getByText("Status scale")).toBeDefined();
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/tasks/7");
    expect(screen.getByText("Submission status")).toBeDefined();
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
    expect(screen.getByText("Grade scale")).toBeDefined();
    expect(screen.getByText("90% - 100%")).toBeDefined();
  });
});
