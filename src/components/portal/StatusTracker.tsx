import { Check, X } from "lucide-react";
import { STAGES, stageStates, type Status } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export function StatusTracker({ status }: { status: Status }) {
  const states = stageStates(status);
  // Phones can't fit every label, so they get one caption for the step in focus.
  const focus = Math.max(
    states.findIndex((s) => s === "current" || s === "blocked"),
    0,
  );
  const focusIndex = states.every((s) => s === "done") ? STAGES.length - 1 : focus;
  return (
    <div>
      <ol className="grid gap-0.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))` }} aria-label="Application progress">
        {STAGES.map((s, i) => {
          const st = states[i];
          return (
            <li key={s.key} className="flex flex-col items-center text-center" aria-current={st === "current" ? "step" : undefined}>
              <div className="flex w-full items-center">
                <span className={cn("h-1 flex-1 rounded-full", i === 0 ? "opacity-0" : states[i - 1] === "done" ? "bg-maroon" : "bg-ink/10")} />
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ring-4 transition sm:h-11 sm:w-11 sm:text-sm",
                    st === "done" && "bg-maroon text-white ring-maroon/15",
                    st === "current" && "bg-gold text-ink ring-gold/30 animate-pulse",
                    st === "blocked" && "bg-red-600 text-white ring-red-200",
                    st === "upcoming" && "bg-white text-ink/40 ring-ink/5",
                  )}
                >
                  {st === "done" ? (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                  ) : st === "blocked" ? (
                    <X className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={cn("h-1 flex-1 rounded-full", i === STAGES.length - 1 ? "opacity-0" : st === "done" ? "bg-maroon" : "bg-ink/10")} />
              </div>
              <span className={cn("mt-2 hidden font-bold leading-tight sm:block sm:text-sm", st === "upcoming" ? "text-ink/40" : "text-ink")}>{s.label}</span>
              <span className="sr-only">{st}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-sm sm:hidden">
        <span className="font-bold text-ink/50">
          Step {focusIndex + 1} of {STAGES.length} ·{" "}
        </span>
        <span className="font-black text-ink">{STAGES[focusIndex].label}</span>
        <span className="block text-xs text-ink/50">{STAGES[focusIndex].description}</span>
      </p>
    </div>
  );
}
