import Link from "next/link";
import { ArrowRight, CalendarDays, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { openToday } from "@/app/sessions/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Pct } from "@/components/tracking/Metric";
import { myTeachingCohortIds } from "@/lib/checkin-data";
import { statsByStudent, type TrackedCohort } from "@/lib/tracking-data";
import { ATTENDANCE_MIN } from "@/lib/tracking";
import { cohortPhase, dateRange, meetsOn, shortDate, todayInArizona } from "@/lib/schedule";

export const metadata = { title: "Today" };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" });

export default async function TeachHome() {
  const session = await requirePermission("cohorts.teach", "/teach");
  const supabase = await createClient();
  const today = todayInArizona();
  const ids = await myTeachingCohortIds(supabase, session.userId);
  const [{ data: cohortRows }, { data: sessions }, stats] = await Promise.all([
    ids.length
      ? supabase.from("cohorts").select("id, name, format, start_date, end_date, schedule, location, status, program_id, programs(short_name, employer_partner)").in("id", ids).order("start_date")
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("cohort_sessions").select("id, cohort_id, session_date, canceled, session_checkins(opened_at, closes_at, closed_at)").in("cohort_id", ids).gte("session_date", today).order("session_date").limit(60)
      : Promise.resolve({ data: [] }),
    statsByStudent(supabase, ids),
  ]);
  const cohorts = (cohortRows ?? []) as unknown as TrackedCohort[];
  const byId = new Map(cohorts.map((c) => [c.id, c]));
  type S = { id: string; cohort_id: string; session_date: string; canceled: boolean; session_checkins: Array<{ opened_at: string; closes_at: string; closed_at: string | null }> };
  const all = (sessions ?? []) as unknown as S[];
  const todays = cohorts.filter((c) => meetsOn(c, today) || all.some((s) => s.cohort_id === c.id && s.session_date === today));
  const upcoming = all.filter((s) => s.session_date > today && !s.canceled).slice(0, 8);

  return (
    <div>
      <PageHeader eyebrow="Instructor" title="Today" description={new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })} />
      {ids.length === 0 ? (
        <EmptyState title="You're not assigned to any cohorts yet">Ask your program admin to add you to a cohort in the Instructor directory.</EmptyState>
      ) : (
        <div className="grid gap-8">
          <section className="grid gap-3">
            {todays.length === 0 ? (
              <Card className="text-sm text-ink/60">No classes today for your cohorts.</Card>
            ) : (
              todays.map((c) => {
                const s = all.find((x) => x.cohort_id === c.id && x.session_date === today);
                const w = s?.session_checkins?.slice().sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0];
                const open = w && !w.closed_at && new Date(w.closes_at).getTime() > Date.now();
                return (
                  <Card key={c.id} className={open ? "border-emerald-300 bg-emerald-50/40" : "border-gold/60"}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-widest text-maroon">{c.programs?.short_name}</p>
                        <p className="mt-1 text-xl font-black">{c.name}</p>
                        <p className="text-sm text-ink/60">
                          {c.location} · {c.schedule}
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {s?.canceled ? "Canceled today" : open ? `Check-in open until ${time(w!.closes_at)}` : w ? `Check-in taken at ${time(w.opened_at)}` : "Check-in not started"}
                        </p>
                      </div>
                      {!s?.canceled &&
                        (s ? (
                          <Link href={open ? `/sessions/${s.id}/screen` : `/sessions/${s.id}`} className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 font-black text-ink shadow hover:brightness-95">
                            <QrCode className="h-5 w-5" aria-hidden /> {open ? "Show QR screen" : w ? "Open attendance" : "Start check-in"}
                          </Link>
                        ) : (
                          <ActionForm action={openToday}>
                            <input type="hidden" name="cohort_id" value={c.id} />
                            <SubmitButton size="lg" pendingText="Opening…">
                              <QrCode className="h-5 w-5" aria-hidden /> Start check-in
                            </SubmitButton>
                          </ActionForm>
                        ))}
                    </div>
                  </Card>
                );
              })
            )}
          </section>

          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-ink/60">
                <CalendarDays className="h-4 w-4" aria-hidden /> Coming up
              </h2>
              <ul className="divide-y divide-ink/5 rounded-2xl border border-ink/10 bg-white">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="font-bold">
                      {new Date(`${s.session_date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} {shortDate(s.session_date)}
                    </span>
                    <span className="text-ink/60">{byId.get(s.cohort_id)?.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-ink/60">My cohorts</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {cohorts.map((c) => {
                const mine = Array.from(stats.values()).filter((x) => x.cohortId === c.id);
                const att = mine.flatMap((x) => (x.attendance === null ? [] : [x.attendance]));
                const avg = att.length ? Math.round((att.reduce((a, b) => a + b, 0) / att.length) * 10) / 10 : null;
                const low = mine.filter((x) => x.lowAttendance).length;
                return (
                  <Link key={c.id} href={`/teach/cohorts/${c.id}`} className="group">
                    <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black">{c.name}</p>
                          <p className="text-xs text-ink/50">
                            {dateRange(c)} · {cohortPhase(c, today).label}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-ink/30 group-hover:text-maroon" aria-hidden />
                      </div>
                      <p className="mt-3 text-sm">
                        {mine.length} trainees · attendance <Pct value={avg} kind="attendance" />
                        {low > 0 && <span className="ml-2 text-xs font-bold text-red-700">{low} below {ATTENDANCE_MIN}%</span>}
                      </p>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
