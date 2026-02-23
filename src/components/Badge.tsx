import React from "react";

interface BadgeProps {
  label: string;
  color?: "red" | "blue" | "yellow" | "gray";
  icon?: React.ReactNode;
}

export function Badge({ label, color = "gray", icon }: BadgeProps) {
  const colorClasses = {
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    yellow:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[color]}`}
    >
      {icon}
      {label}
    </span>
  );
}
