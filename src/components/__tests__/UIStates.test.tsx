import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FileText } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";

afterEach(() => {
  cleanup();
});

describe("shared UI states", () => {
  it("renders an empty state with icon, copy, and action", () => {
    const onClick = vi.fn();

    render(
      <EmptyState
        icon={<FileText aria-hidden="true" size={20} />}
        title="No files downloaded yet"
        hint="Use the sync button to fetch course materials."
        action={{ label: "Sync now", onClick }}
      />,
    );

    expect(screen.getByText("No files downloaded yet")).toBeDefined();
    expect(
      screen.getByText("Use the sync button to fetch course materials."),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a loading state with status text and skeleton rows", () => {
    render(<LoadingState label="Loading tasks..." />);

    expect(screen.getByText("Loading tasks...")).toBeDefined();
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getAllByTestId("loading-skeleton-row")).toHaveLength(3);
  });

  it("renders an error state with retry handling", () => {
    const onRetry = vi.fn();

    render(
      <ErrorState
        message="Failed to load grades."
        hint="Check your connection, then retry the sync."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Failed to load grades.")).toBeDefined();
    expect(
      screen.getByText("Check your connection, then retry the sync."),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
