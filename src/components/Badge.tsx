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
      classes: "bg-red-500/14 text-red-300",
      dot: "bg-red-400",
    },
    ap1: {
      classes: "bg-indigo-500/14 text-indigo-300",
      dot: "bg-indigo-500",
    },
    ap2: {
      classes: "bg-sky-400/14 text-sky-300",
      dot: "bg-sky-400",
    },
    active: {
      classes: "bg-indigo-500/14 text-indigo-300",
      dot: null,
    },
    completed: {
      classes: "bg-emerald-500/14 text-emerald-400",
      dot: null,
    },
    "content-match": {
      classes: "bg-amber-500/14 text-amber-400",
      dot: null,
    },
    tag: {
      classes: "border border-slate-700 bg-slate-800 text-slate-400 font-medium",
      dot: null,
    },
    neutral: {
      classes: "border border-slate-700 bg-slate-800 text-slate-400 font-medium",
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
