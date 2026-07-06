import { Loader2 } from "lucide-react";

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  const widths = ["w-[82%]", "w-[64%]", "w-[73%]"];

  return (
    <div className="py-2" role="status" aria-live="polite">
      <div className="flex items-center justify-center gap-[9px] px-0 pb-[22px] pt-4 text-[13px] text-slate-400">
        <Loader2
          aria-hidden="true"
          size={17}
          strokeWidth={2.4}
          className="animate-spin text-indigo-500"
        />
        {label}
      </div>
      <div className="flex flex-col gap-[9px]" aria-hidden="true">
        {widths.map((width, index) => (
          <div
            key={width}
            data-testid="loading-skeleton-row"
            className={`h-3 rounded-[5px] bg-slate-800 ${width} animate-pulse`}
            style={{ animationDelay: `${index * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
