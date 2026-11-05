import { TrendingDown, TrendingUp } from "lucide-react";
import { latenessSummary, weeklyTrend, type DayMark } from "@/lib/tracking";
import { shortDate } from "@/lib/schedule";
import { cn } from "@/lib/utils";

/**
 * Lateness over time: a bar per week (share of sessions late, with absences shown on top) and a short summary.
 * Used for one trainee (their marks) or a whole cohort (weekly totals).
 */
export function LatenessTrend({
  marks,
  weeks: weeksIn,
  today,
  title = "Lateness trend",
  compact = false,
}: {
  marks?: DayMark[];
  weeks?: Array<{ week: string; sessions: number; late: number; absent: number; present?: number }>;
  today: string;
  title?: string;
  compact?: boolean;
}) {
  const weeks = weeksIn ?? weeklyTrend(marks ?? [], today);
  const summary = marks ? latenessSummary(marks, today) : null;
  if (!weeks.length) return compact ? null : <p className="text-sm text-ink/50">No attendance recorded yet.</p>;
  const maxRate = Math.max(0.25, ...weeks.map((w) => (w.sessions ? (w.late + w.absent) / w.sessions : 0)));
  const totalLate = weeks.reduce((a, w) => a + w.late, 0);
  const totalSessions = weeks.reduce((a, w) => a + w.sessions, 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-black">{title}</p>
        <p className="text-xs text-ink/60">
          {summary
            ? `${summary.late} late of ${summary.sessions} sessions${summary.recentCount ? ` · ${summary.recentLate} in the last ${summary.recentCount}` : ""}${
                summary.avgMinutesAfterOpen !== null ? ` · checks in ${summary.avgMinutesAfterOpen} min after opening on average` : ""
              }`
            : `${totalLate} late arrival${totalLate === 1 ? "" : "s"} across ${totalSessions} attendance records`}
        </p>
      </div>
      {summary?.trend && summary.trend !== "steady" && (
        <p className={cn("mt-1 inline-flex items-center gap-1 text-xs font-bold", summary.trend === "worse" ? "text-red-700" : "text-emerald-700")}>
          {summary.trend === "worse" ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
          {summary.trend === "worse" ? "Late more often recently" : "Late less often recently"}
        </p>
      )}
      <div className={cn("mt-3 flex items-end gap-1.5", compact ? "h-14" : "h-24")} role="img" aria-label={`Weekly lateness: ${weeks.map((w) => `${w.late} late of ${w.sessions}`).join(", ")}`}>
        {weeks.map((w) => {
          const late = w.sessions ? w.late / w.sessions : 0;
          const absent = w.sessions ? w.absent / w.sessions : 0;
          return (
            <div key={w.week} className="flex h-full min-w-3 flex-1 flex-col justify-end" title={`Week of ${shortDate(w.week)}: ${w.late} late, ${w.absent} absent, ${w.sessions} total`}>
              <div className="rounded-t bg-red-400/70" style={{ height: `${(absent / maxRate) * 100}%` }} />
              <div className={cn("bg-amber-500", absent ? "" : "rounded-t")} style={{ height: `${(late / maxRate) * 100}%`, minHeight: w.late ? 3 : 0 }} />
              <div className="h-px bg-ink/15" />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink/40">
          <span>{compact ? `Weekly, from ${shortDate(weeks[0].week, false)}` : `Week of ${shortDate(weeks[0].week, false)}`}</span>
          <span className="flex gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-amber-500" /> Late
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-red-400/70" /> Absent
            </span>
          </span>
          <span>{shortDate(weeks[weeks.length - 1].week, false)}</span>
        </div>
    </div>
  );
}

/** Compact table cell: lates in the last 10 sessions with a worse/better arrow. */
export function LateCell({ marks, today }: { marks: DayMark[]; today: string }) {
  const s = latenessSummary(marks, today);
  if (!s.sessions) return <span className="text-ink/40">—</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" title={`${s.late} late of ${s.sessions} sessions overall`}>
      <span className={cn("font-bold", s.recentLate >= 3 ? "text-amber-700" : "")}>
        {s.recentLate}/{s.recentCount}
      </span>
      {s.trend === "worse" && <TrendingUp className="h-3.5 w-3.5 text-red-700" aria-label="Late more often recently" />}
      {s.trend === "better" && <TrendingDown className="h-3.5 w-3.5 text-emerald-700" aria-label="Late less often recently" />}
    </span>
  );
}
