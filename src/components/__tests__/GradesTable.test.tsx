import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { GradesTable } from "../GradesTable";

const mockFetch = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      exportAriaLabel: "Export grades to CSV",
      exportLabel: "Export CSV",
      loading: "Loading grades...",
      loadFailed: "Failed to load grades.",
      empty: "No grades synced yet",
      unknownCourse: "Unknown course",
      noFeedback: "No feedback",
      gradeUnavailable: "Grade unavailable",
      open: "Open",
      opensInNewTab: "opens in new tab",
      openInNewTab: "Open Assignment in new tab",
      colCourse: "Course",
      colAssignment: "Assignment",
      colGrade: "Grade",
      colScore: "Score",
      colFeedback: "Feedback",
    };

    return (key: string) => messages[key] ?? key;
  },
}));

function renderWithSWR() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <GradesTable />
    </SWRConfig>,
  );
}

describe("GradesTable", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1,
            assignmentTitle: "Normalisierung Übung 2",
            courseTitle: "Datenbanken",
            gradeString: "1,7",
            score: null,
            feedback: "Saubere 3NF",
            webUrl: "https://school.example/grade",
            updatedAt: "2026-07-06T12:00:00.000Z",
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

  it("renders grade cards with tokenized mono score pills", async () => {
    renderWithSWR();

    await waitFor(() => {
      expect(screen.getByText("Normalisierung Übung 2")).toBeDefined();
    });

    const courseHeading = screen.getByRole("heading", { name: "Datenbanken" });
    expect(courseHeading.className).toContain("text-text-secondary");

    const score = screen.getByText("1,7");
    expect(score.className).toContain("font-mono");
    expect(score.className).toContain("bg-success-subtle");
  });
});
