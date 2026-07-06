import type { ReactNode } from "react";

type EmptyStateAction = {
  label: string;
  onClick: () => void;
};

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: EmptyStateAction;
};

export function EmptyState({ icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 px-5 py-7 text-center">
      <div className="mx-auto mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-[11px] bg-slate-800 text-slate-500">
        {icon}
      </div>
      <p className="mb-1 text-[13px] font-semibold text-slate-100">{title}</p>
      {hint && (
        <p className="mx-auto mb-3 max-w-sm text-xs leading-5 text-slate-500">
          {hint}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center justify-center rounded-[9px] bg-indigo-500 px-[13px] py-[7px] text-xs font-semibold text-white transition-colors hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
