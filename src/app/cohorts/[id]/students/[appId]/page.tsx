import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { emailStudents } from "@/app/cohorts/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { AtRiskBadge, Pct } from "@/components/tracking/Metric";
import { statsByStudent, trackedCohort } from "@/lib/tracking-data";
import { ATTENDANCE_LABEL, GRADE_MIN, type AttendanceStatus, type DayMark } from "@/lib/tracking";
import { shortDate, todayInArizona } from "@/lib/schedule";
import { LatenessTrend } from "@/components/tracking/LatenessTrend";
import { cn } from "@/lib/utils";

export const metadata = { title: "Student progress" };

const DOT: Record<AttendanceStatus, string> = { present: "bg-emerald-500", late: "bg-amber-500", absent: "bg-red-600", excused: "bg-sky-500" };

export default async function StudentProgress({ params }: { params: Promise<{ id: string; appId: string }> }) {
  const { id, appId } = await params;
  await requirePermission("cohorts.track", `/cohorts/${id}/students/${appId}`);
  const supabase = await createClient();
  const cohort = await trackedCohort(supabase, id);
  const { data: app } = await supabase.from("applications").select("id, first_name, last_name, email, phone, status, assigned_cohort_id").eq("id", appId).maybeSingle();
  if (!cohort || !app || app.assigned_cohort_id !== id) notFound();
  const today = todayInArizona();
  const [stats, { data: modules }, { data: grades }, { data: sessions }, { data: marks }] = await Promise.all([
    statsByStudent(supabase, [id]),
    supabase.from("cohort_modules").select("id, name").eq("cohort_id", id).order("sort").order("created_at"),
    supabase.from("module_grades").select("module_id, score").eq("application_id", appId),
    supabase.from("cohort_sessions").select("id, session_date, canceled").eq("cohort_id", id).order("session_date"),
    supabase.from("session_attendance").select("session_id, status, minutes_after_open, checked_in_at, flag").eq("application_id", appId),
  ]);
  const s = stats.get(appId);
  const score = new Map((grades ?? []).map((g) => [g.module_id, Number(g.score)]));
  const mark = new Map((marks ?? []).map((m) => [m.session_id, m.status as AttendanceStatus]));
  const past = (sessions ?? []).filter((x) => !x.canceled && x.session_date <= today);
  const name = `${app.first_name} ${app.last_name}`;
  const minutes = new Map((marks ?? []).map((m) => [m.session_id, m.minutes_after_open as number | null]));
  const dayMarks: DayMark[] = past.flatMap((x) => (mark.get(x.id) ? [{ date: x.session_date, status: mark.get(x.id)!, minutes_after_open: minutes.get(x.id) ?? null }] : []));

  return (
    <div>
      <Link href={`/cohorts/${id}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> {cohort.name}
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow={cohort.programs?.short_name ?? "Trainee"} title={name} />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-ink/70">
        <a href={`mailto:${app.email}`} className="inline-flex items-center gap-1.5 hover:text-maroon">
          <Mail className="h-4 w-4" aria-hidden /> {app.email}
        </a>
        {app.phone && (
          <a href={`tel:${String(app.phone).replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-maroon">
            <Phone className="h-4 w-4" aria-hidden /> {app.phone}
          </a>
        )}
        {s && <AtRiskBadge lowGrade={s.lowGrade} lowAttendance={s.lowAttendance} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="font-black">Grades</h2>
            <span className="text-sm">
              Overall <Pct value={s?.grade ?? null} kind="grade" />
            </span>
          </div>
          {(modules ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">No modules set up for this cohort yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/5">
              {(modules ?? []).map((m) => {
                const v = score.get(m.id);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{m.name}</span>
                    {v === undefined ? <span className="text-ink/40">Not graded</span> : <Pct value={v} kind="grade" />}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink/50">Below {GRADE_MIN}% is highlighted. Edit scores on the cohort&apos;s Grades tab.</p>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="font-black">Attendance</h2>
            <span className="text-sm">
              <Pct value={s?.attendance ?? null} kind="attendance" />
            </span>
          </div>
          <p className="mt-1 text-xs text-ink/60">
            {s?.present ?? 0} present · {s?.late ?? 0} late · {s?.absent ?? 0} absent · {s?.excused ?? 0} excused, of {past.length} sessions held
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {past.map((x) => {
              const st = mark.get(x.id);
              return (
                <span
                  key={x.id}
                  title={`${shortDate(x.session_date)}: ${st ? ATTENDANCE_LABEL[st] : "Not recorded"}`}
                  className={cn("h-4 w-4 rounded", st ? DOT[st] : "bg-ink/10")}
                />
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink/50">
            {(Object.keys(DOT) as AttendanceStatus[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className={cn("h-2.5 w-2.5 rounded-sm", DOT[k])} /> {ATTENDANCE_LABEL[k]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-ink/10" /> Not recorded
            </span>
          </p>
          {past.filter((x) => mark.get(x.id) === "absent" || mark.get(x.id) === "late").length > 0 && (
            <ul className="mt-4 space-y-1 text-xs">
              {past
                .filter((x) => mark.get(x.id) === "absent" || mark.get(x.id) === "late")
                .map((x) => (
                  <li key={x.id} className={mark.get(x.id) === "absent" ? "text-red-700" : "text-amber-700"}>
                    {shortDate(x.session_date)}: {ATTENDANCE_LABEL[mark.get(x.id)!]}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <LatenessTrend marks={dayMarks} today={today} />
      </Card>

      <Card className="mt-6">
        <h2 className="font-black">Email {app.first_name}</h2>
        <ActionForm action={emailStudents} resetOnSuccess className="mt-3 grid gap-3">
          <input type="hidden" name="cohort_id" value={id} />
          <input type="hidden" name="audience" value="selected" />
          <input type="hidden" name="ids" value={appId} />
          <div>
            <Label htmlFor="st-subject">Subject</Label>
            <Input id="st-subject" name="subject" required minLength={3} maxLength={150} />
          </div>
          <div>
            <Label htmlFor="st-body">Message</Label>
            <Textarea id="st-body" name="body" required minLength={3} maxLength={5000} className="min-h-28" />
          </div>
          <SubmitButton size="sm" variant="dark" className="justify-self-start" pendingText="Sending…">
            Send email
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
