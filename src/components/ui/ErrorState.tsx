import { AlertCircle } from "lucide-react";

type ErrorStateProps = {
  message: string;
  hint?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  message,
  hint,
  onRetry,
  retryLabel = "Retry",
}: ErrorStateProps) {
  return (
    <div className="flex gap-[11px] rounded-xl border border-red-500/30 bg-red-500/[.08] px-[15px] py-3.5">
      <AlertCircle
        aria-hidden="true"
        size={18}
        className="mt-px flex-none text-red-400"
      />
      <div>
        <p className="mb-[3px] text-[13px] font-semibold text-red-400">
          {message}
        </p>
        {hint && <p className="mb-2.5 text-xs leading-5 text-red-300">{hint}</p>}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-lg border border-red-500/40 px-[11px] py-[5px] text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
