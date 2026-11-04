import { Card } from "@/components/ui";
import { Pct } from "@/components/tracking/Metric";
import { ATTENDANCE_MIN, GRADE_MIN, type StudentStats } from "@/lib/tracking";

export type ModuleScore = { name: string; score: number | null };

/** A trainee's grades and attendance, for the trainee (portal) and partner employers. */
export function ProgressCard({
  title,
  stats,
  modules,
  audience,
}: {
  title: string;
  stats: Pick<StudentStats, "grade" | "attendance" | "present" | "late" | "absent" | "excused" | "lowGrade" | "lowAttendance">;
  modules: ModuleScore[];
  audience: "trainee" | "employer";
}) {
  const nothingYet = stats.grade === null && stats.attendance === null && modules.every((m) => m.score === null);
  return (
    <Card>
      <h2 className="text-lg font-black">{title}</h2>
      {nothingYet ? (
        <p className="mt-2 text-sm text-ink/60">
          {audience === "trainee" ? "Your grades and attendance will appear here once your cohort manager starts recording them." : "No grades or attendance recorded yet."}
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={`rounded-2xl p-4 ${stats.lowGrade ? "bg-red-50" : "bg-mist"}`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Overall grade</p>
              <p className="mt-1 text-2xl font-black">
                <Pct value={stats.grade} kind="grade" className="text-2xl" />
              </p>
              <p className="text-xs text-ink/50">Goal: {GRADE_MIN}% or higher</p>
            </div>
            <div className={`rounded-2xl p-4 ${stats.lowAttendance ? "bg-red-50" : "bg-mist"}`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Attendance</p>
              <p className="mt-1 text-2xl font-black">
                <Pct value={stats.attendance} kind="attendance" className="text-2xl" />
              </p>
              <p className="text-xs text-ink/50">
                {stats.present} present · {stats.late} late · {stats.absent} absent{stats.excused ? ` · ${stats.excused} excused` : ""}
              </p>
            </div>
          </div>
          {audience === "trainee" && (stats.lowGrade || stats.lowAttendance) && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {stats.lowAttendance && `Your attendance is below ${ATTENDANCE_MIN}%. `}
              {stats.lowGrade && `Your grade is below ${GRADE_MIN}%. `}
              Reach out to your cohort manager or instructors. They&apos;re here to help you get back on track.
            </p>
          )}
          {modules.length > 0 && (
            <ul className="mt-4 divide-y divide-ink/5">
              {modules.map((m) => (
                <li key={m.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{m.name}</span>
                  {m.score === null ? <span className="text-ink/40">Not graded yet</span> : <Pct value={m.score} kind="grade" />}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
