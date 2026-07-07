import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "../Badge";

afterEach(() => {
  cleanup();
});

describe("Badge", () => {
  it("maps AP2 exam flags to the sky variant while preserving the color prop API", () => {
    render(<Badge label="AP2" color="blue" />);

    const badge = screen.getByText("AP2").closest("span");

    expect(badge?.className).toContain("bg-sky-subtle");
    expect(badge?.className).toContain("text-sky");
  });

  it("renders user tags as neutral hash chips from the existing yellow color", () => {
    render(<Badge label="Netzwerke" color="yellow" />);

    const badge = screen.getByText("Netzwerke").closest("span");

    expect(screen.getByText("#")).toBeDefined();
    expect(badge?.className).toContain("bg-slate-800");
    expect(badge?.className).toContain("border-slate-700");
  });
});
