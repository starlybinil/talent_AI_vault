import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Pct } from "@/components/tracking/Metric";
import { statsByStudent, trackedCohorts } from "@/lib/tracking-data";
import { ATTENDANCE_MIN, GRADE_MIN } from "@/lib/tracking";
import { cohortPhase, dateRange, todayInArizona } from "@/lib/schedule";

export const metadata = { title: "Cohort tracking" };

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export default async function CohortTrackingHome() {
  const session = await requirePermission("cohorts.track", "/cohorts");
  const supabase = await createClient();
  const cohorts = await trackedCohorts(supabase, session.userId, session.roles.includes("program_admin"));
  const stats = await statsByStudent(supabase, cohorts.map((c) => c.id));
  const today = todayInArizona();
  const rows = cohorts.map((c) => {
    const mine = Array.from(stats.values()).filter((s) => s.cohortId === c.id);
    return {
      c,
      phase: cohortPhase(c, today),
      trainees: mine.length,
      grade: avg(mine.flatMap((s) => (s.grade === null ? [] : [s.grade]))),
      attendance: avg(mine.flatMap((s) => (s.attendance === null ? [] : [s.attendance]))),
      atRisk: mine.filter((s) => s.atRisk).length,
    };
  });
  const order = { running: 0, upcoming: 1, completed: 2 } as const;
  rows.sort((a, b) => order[a.phase.key] - order[b.phase.key] || a.c.start_date.localeCompare(b.c.start_date));

  return (
    <div>
      <PageHeader
        eyebrow="Cohort tracking"
        title="Your cohorts"
        description={`Grades and attendance for every trainee. Students below ${GRADE_MIN}% grade or ${ATTENDANCE_MIN}% attendance are flagged as at risk.`}
      />
      {rows.length === 0 ? (
        <EmptyState title="No cohorts assigned yet">Ask an IT admin to assign you to a program on the Users &amp; roles page.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ c, phase, trainees, grade, attendance, atRisk }) => (
            <Link key={c.id} href={`/cohorts/${c.id}`} className="group">
              <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-maroon">{c.programs?.short_name}</p>
                    <h2 className="mt-1 text-lg font-black leading-snug">{c.name}</h2>
                    <p className="text-xs text-ink/50">
                      {dateRange(c)} · {c.location}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-maroon" aria-hidden />
                </div>
                <p className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${phase.key === "running" ? "bg-emerald-50 text-emerald-800" : "bg-ink/5 text-ink/60"}`}>
                  {phase.label}
                </p>
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Trainees</dt>
                    <dd className="mt-1 flex items-center justify-center gap-1 font-black">
                      <Users className="h-3.5 w-3.5 text-ink/40" aria-hidden /> {trainees}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Avg grade</dt>
                    <dd className="mt-1"><Pct value={grade} kind="grade" /></dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Attendance</dt>
                    <dd className="mt-1"><Pct value={attendance} kind="attendance" /></dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-ink/50">At risk</dt>
                    <dd className={`mt-1 font-black ${atRisk ? "text-red-700" : "text-ink"}`}>{atRisk}</dd>
                  </div>
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
