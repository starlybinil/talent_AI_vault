import { Check, X } from "lucide-react";
import { STAGES, stageStates, type Status } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export function StatusTracker({ status }: { status: Status }) {
  const states = stageStates(status);
  return (
    <ol className="grid grid-cols-6 gap-1 sm:gap-2" aria-label="Application progress">
      {STAGES.map((s, i) => {
        const st = states[i];
        return (
          <li key={s.key} className="flex flex-col items-center text-center" aria-current={st === "current" ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span className={cn("h-1 flex-1 rounded-full", i === 0 ? "opacity-0" : states[i - 1] === "done" ? "bg-maroon" : "bg-ink/10")} />
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ring-4 transition sm:h-11 sm:w-11",
                  st === "done" && "bg-maroon text-white ring-maroon/15",
                  st === "current" && "bg-gold text-ink ring-gold/30 animate-pulse",
                  st === "blocked" && "bg-red-600 text-white ring-red-200",
                  st === "upcoming" && "bg-white text-ink/40 ring-ink/5",
                )}
              >
                {st === "done" ? <Check className="h-5 w-5" aria-hidden /> : st === "blocked" ? <X className="h-5 w-5" aria-hidden /> : i + 1}
              </span>
              <span className={cn("h-1 flex-1 rounded-full", i === STAGES.length - 1 ? "opacity-0" : st === "done" ? "bg-maroon" : "bg-ink/10")} />
            </div>
            <span className={cn("mt-2 text-[11px] font-bold leading-tight sm:text-sm", st === "upcoming" ? "text-ink/40" : "text-ink")}>
              {s.label}
            </span>
            <span className="sr-only">{st}</span>
          </li>
        );
      })}
    </ol>
  );
}
