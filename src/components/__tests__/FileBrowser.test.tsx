import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FileBrowser } from "../FileBrowser";

// Mocks
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
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
});
