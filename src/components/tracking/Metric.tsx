import { ATTENDANCE_MIN, GRADE_MIN } from "@/lib/tracking";
import { cn } from "@/lib/utils";

/** A grade or attendance percentage, red when below the threshold. */
export function Pct({ value, kind, className }: { value: number | null; kind: "grade" | "attendance"; className?: string }) {
  if (value === null) return <span className={cn("text-ink/40", className)}>—</span>;
  const low = value < (kind === "grade" ? GRADE_MIN : ATTENDANCE_MIN);
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-sm font-black tabular-nums", low ? "bg-red-100 text-red-800" : "text-ink", className)}
      title={low ? (kind === "grade" ? `Below ${GRADE_MIN}%` : `Below ${ATTENDANCE_MIN}%`) : undefined}
    >
      {value}%
    </span>
  );
}

export function AtRiskBadge({ lowGrade, lowAttendance }: { lowGrade: boolean; lowAttendance: boolean }) {
  if (!lowGrade && !lowAttendance) return null;
  const why = [lowGrade && `grade < ${GRADE_MIN}%`, lowAttendance && `attendance < ${ATTENDANCE_MIN}%`].filter(Boolean).join(" · ");
  return <span className="inline-flex rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">At risk · {why}</span>;
}
