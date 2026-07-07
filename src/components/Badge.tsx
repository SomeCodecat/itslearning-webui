import React from "react";
import { Check } from "lucide-react";

interface BadgeProps {
  label: string;
  color?: "red" | "blue" | "yellow" | "gray";
  icon?: React.ReactNode;
  variant?:
    | "exam"
    | "ap1"
    | "ap2"
    | "active"
    | "completed"
    | "content-match"
    | "tag"
    | "neutral";
}

function inferVariant(
  label: string,
  color: NonNullable<BadgeProps["color"]>,
  variant?: BadgeProps["variant"],
): NonNullable<BadgeProps["variant"]> {
  if (variant) return variant;

  const normalized = label.toLowerCase();

  if (color === "red") return "exam";
  if (color === "yellow") return "tag";
  if (color === "blue") return normalized.includes("ap2") ? "ap2" : "ap1";
  if (normalized.includes("completed")) return "completed";
  if (normalized.includes("match")) return "content-match";
  if (normalized.includes("active")) return "active";

  return "neutral";
}

export function Badge({
  label,
  color = "gray",
  icon,
  variant,
}: BadgeProps) {
  const resolvedVariant = inferVariant(label, color, variant);
  const variants = {
    exam: {
      classes: "bg-error-subtle text-error",
      dot: "bg-error",
    },
    ap1: {
      classes: "bg-accent-subtle text-accent-text",
      dot: "bg-accent",
    },
    ap2: {
      classes: "bg-sky-subtle text-sky",
      dot: "bg-sky-dot",
    },
    active: {
      classes: "bg-accent-subtle text-accent-text",
      dot: null,
    },
    completed: {
      classes: "bg-success-subtle text-success",
      dot: null,
    },
    "content-match": {
      classes: "bg-warning-subtle text-warning",
      dot: null,
    },
    tag: {
      classes: "border border-line-strong bg-elevated text-text-secondary font-medium",
      dot: null,
    },
    neutral: {
      classes: "border border-line-strong bg-elevated text-text-secondary font-medium",
      dot: null,
    },
  };
  const config = variants[resolvedVariant];
  const showHash = resolvedVariant === "tag";
  const resolvedIcon =
    icon ||
    (resolvedVariant === "completed" ? (
      <Check aria-hidden="true" size={11} strokeWidth={3} />
    ) : null);

  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-full px-[11px] py-1 text-xs font-semibold ${config.classes}`}
    >
      {config.dot && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-[2px] ${config.dot}`}
        />
      )}
      {showHash && <span className="text-slate-500">#</span>}
      {resolvedIcon}
      {label}
    </span>
  );
}
