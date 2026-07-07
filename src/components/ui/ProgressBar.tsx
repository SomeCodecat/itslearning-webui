"use client";

import React from "react";

interface ProgressBarProps {
  /**
   * Completion percentage from 0–100. When null/undefined the bar renders in an
   * indeterminate (pulsing) state — used while the server is busy but hasn't
   * reported measurable progress yet (e.g. compressing a ZIP).
   */
  value?: number | null;
  className?: string;
  "aria-label"?: string;
}

/**
 * Slim horizontal progress bar built from design tokens. Determinate when a
 * numeric `value` is supplied, indeterminate (pulsing) otherwise.
 */
export function ProgressBar({
  value,
  className = "",
  "aria-label": ariaLabel,
}: ProgressBarProps) {
  const indeterminate = value == null || Number.isNaN(value);
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-elevated-strong ${className}`}
    >
      <div
        className={`h-full rounded-full bg-accent ${
          indeterminate
            ? "w-full animate-pulse"
            : "transition-[width] duration-200 ease-out"
        }`}
        style={indeterminate ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}
