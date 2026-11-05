import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { Pct } from "@/components/tracking/Metric";
import { LateCell, LatenessTrend } from "@/components/tracking/LatenessTrend";
import { cohortMarks, cohortRoster, cohortWeeks, statsByStudent, trackedCohort } from "@/lib/tracking-data";
import { ATTENDANCE_MIN } from "@/lib/tracking";
import { dateRange, shortDate, todayInArizona } from "@/lib/schedule";

export const metadata = { title: "Cohort attendance" };

export default async function TeachCohort({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("cohorts.teach", `/teach/cohorts/${id}`);
  const supabase = await createClient();
  const today = todayInArizona();
  const { data: teaches } = await supabase.rpc("teaches_cohort", { p_cohort: id });
  const cohort = teaches ? await trackedCohort(supabase, id) : null;
  if (!cohort) notFound();

  const [roster, stats, marks, weeks, { data: sessions }] = await Promise.all([
    cohortRoster(supabase, id),
    statsByStudent(supabase, [id]),
    cohortMarks(supabase, id),
    cohortWeeks(supabase, id),
    supabase.from("cohort_sessions").select("id, session_date, canceled").eq("cohort_id", id).lte("session_date", today).order("session_date", { ascending: false }).limit(12),
  ]);
  const low = roster.filter((t) => stats.get(t.id)?.lowAttendance).length;

  return (
    <div>
      <Link href="/teach" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-maroon hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Today
      </Link>
      <PageHeader eyebrow={cohort.programs?.short_name ?? "Cohort"} title={cohort.name} description={`${dateRange(cohort)} · ${cohort.schedule} · ${cohort.location}`} />

      <div className="grid gap-6">
        <Card>
          <LatenessTrend weeks={weeks} today={today} title="Cohort lateness by week" />
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 px-4 py-3">
            <p className="font-black">{roster.length} trainees</p>
            {low > 0 && (
              <p className="text-sm font-bold text-red-700">
                {low} below {ATTENDANCE_MIN}% attendance
              </p>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-ink/50">
              <tr>
                <th className="px-4 py-2">Trainee</th>
                <th className="px-4 py-2">Attendance</th>
                <th className="px-4 py-2">Absent</th>
                <th className="px-4 py-2" title="Late in the last 10 sessions">
                  Late (last 10)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {roster.map((t) => {
                const s = stats.get(t.id);
                return (
                  <tr key={t.id} className={s?.lowAttendance ? "bg-red-50/60" : undefined}>
                    <td className="px-4 py-2 font-bold">
                      {t.last_name}, {t.first_name}
                    </td>
                    <td className="px-4 py-2">
                      <Pct value={s?.attendance ?? null} kind="attendance" />
                    </td>
                    <td className="px-4 py-2 tabular-nums">{s?.absent ?? 0}</td>
                    <td className="px-4 py-2">
                      <LateCell marks={marks.get(t.id) ?? []} today={today} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <section>
          <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-ink/60">Recent sessions</h2>
          <ul className="divide-y divide-ink/5 rounded-2xl border border-ink/10 bg-white">
            {(sessions ?? []).map((s) => (
              <li key={s.id}>
                <Link href={`/sessions/${s.id}`} className="flex justify-between gap-3 px-4 py-2.5 text-sm hover:bg-mist">
                  <span className="font-bold">
                    {new Date(`${s.session_date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} {shortDate(s.session_date)}
                  </span>
                  <span className="text-ink/60">{s.canceled ? "Canceled" : s.session_date === today ? "Today · take attendance" : "View"}</span>
                </Link>
              </li>
            ))}
            {!sessions?.length && <li className="px-4 py-3 text-sm text-ink/50">No sessions yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
