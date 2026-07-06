import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { FileBrowser } from "../FileBrowser";

// Mocks
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (
      {
        ap1: "AP1",
        ap2: "AP2",
        examRelevant: "Exam Relevant",
        viewInItslearning: "View in itslearning",
        download: "Download",
        contentMatchedBadge: "matched in content",
        flagMenuLabel: "Toggle IHK flags",
        flagMenuTitle: "IHK flags",
        searchPlaceholder: "Search files...",
        filterAll: "All",
        filterExam: "Exam",
        allTags: "All tags",
        sortNewestFirst: "Newest First",
        sortOldestFirst: "Oldest First",
        sortNameAsc: "Name (A-Z)",
        noMatches: "No files match your filters.",
        unnamedFile: "Unnamed File",
        groupingFlat: "Flat",
        groupingTopic: "By topic",
        groupingCourse: "By course",
        ungrouped: "Ungrouped",
      } as Record<string, string>
    )[key] ?? key,
  useFormatter: () => ({
    dateTime: (date: Date) => date.toLocaleDateString("en"),
  }),
}));

// FileCard uses fetch for PATCH — stub it so tests don't hit the network
vi.stubGlobal("fetch", vi.fn());

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FileBrowser", () => {
  const mockFiles = [
    { id: 1, customName: "AP1 File", isAP1: true, isExamRelevant: true },
    { id: 2, customName: "AP2 File", isAP2: true, isExamRelevant: true },
    { id: 3, customName: "Normal File", isAP1: false, isAP2: false },
  ];

  it("renders all files by default", () => {
    render(<FileBrowser files={mockFiles} />);

    // Check if elements exist. Since Badge text might interfere, use specific text match or check titles
    // The FileCard puts the text in an H3.
    expect(screen.getByRole("heading", { name: "AP1 File" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "AP2 File" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Normal File" })).toBeDefined();
  });

  it("renders filtered list correctly", () => {
    const filtered = mockFiles.filter((f) => f.isAP1);
    render(<FileBrowser files={filtered} />);

    expect(screen.getByRole("heading", { name: "AP1 File" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "AP2 File" })).toBeNull();
  });

  it("hides flag toggle buttons when persistable=false", () => {
    render(<FileBrowser files={mockFiles} persistable={false} />);

    // No flag-menu buttons should be rendered
    const flagBtns = screen.queryAllByRole("button", { name: /IHK flags/i });
    expect(flagBtns).toHaveLength(0);
  });

  it("shows flag toggle buttons when persistable=true (default)", () => {
    render(<FileBrowser files={mockFiles} />);

    const flagBtns = screen.queryAllByRole("button", { name: /IHK flags/i });
    // One button per file
    expect(flagBtns).toHaveLength(mockFiles.length);
  });

  it("toggles grouping to 'By topic', renders group headers, and collapsing hides files", () => {
    const mockGroupFiles = [
      { id: 1, customName: "File A", topic: "Topic 1" },
      { id: 2, customName: "File B", topic: "Topic 1" },
      { id: 3, customName: "File C", topic: "Topic 2" },
    ];

    render(<FileBrowser files={mockGroupFiles} />);

    // By default, it's "flat" grouping, so no group headers should be visible
    expect(screen.queryByRole("button", { name: /Topic 1/ })).toBeNull();

    // Find the grouping button for topic
    const topicBtn = screen.getByRole("button", { name: "By topic" });
    expect(topicBtn).toBeDefined();

    // Click it to switch to topic grouping
    fireEvent.click(topicBtn);

    // Group headers should now exist
    const group1Header = screen.getByRole("button", { name: /Topic 1/ });
    const group2Header = screen.getByRole("button", { name: /Topic 2/ });
    expect(group1Header).toBeDefined();
    expect(group2Header).toBeDefined();

    // The files should be visible
    expect(screen.getByRole("heading", { name: "File A" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "File B" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "File C" })).toBeDefined();

    // Now let's collapse Topic 2
    fireEvent.click(group2Header);

    // Check that the container is collapsed (contains hidden class)
    const group2Content = screen.getByRole("heading", { name: "File C" }).closest("[id^='group-content-']");
    expect(group2Content?.className).toContain("hidden");
  });
});
