import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarPlus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { addModule, addSession, createSessionsFromSchedule, deleteModule, emailStudents, moveModule, renameModule, setSessionCanceled } from "@/app/cohorts/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { GradesGrid } from "@/components/tracking/GradesGrid";
import { AttendanceSheet } from "@/components/tracking/AttendanceSheet";
import { RosterTable, type RosterRow } from "@/components/tracking/RosterTable";
import { Pct } from "@/components/tracking/Metric";
import { cohortRoster, fetchAll, statsByStudent, trackedCohort } from "@/lib/tracking-data";
import { ATTENDANCE_MIN, GRADE_MIN, type AttendanceStatus } from "@/lib/tracking";
import { cohortPhase, dateRange, shortDate, todayInArizona } from "@/lib/schedule";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Cohort tracking" };

const TABS = [
  { key: "roster", label: "Roster" },
  { key: "grades", label: "Grades" },
  { key: "attendance", label: "Attendance" },
  { key: "email", label: "Email" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export default async function CohortTracking({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; session?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  await requirePermission("cohorts.track", `/cohorts/${id}`);
  const supabase = await createClient();
  const cohort = await trackedCohort(supabase, id);
  if (!cohort) notFound();
  const { data: canManage } = await supabase.rpc("manages_cohort", { p_cohort: id });
  if (!canManage) notFound();
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "roster") as Tab;
  const today = todayInArizona();

  const [roster, stats, { data: modules }, { data: sessions }] = await Promise.all([
    cohortRoster(supabase, id),
    statsByStudent(supabase, [id]),
    supabase.from("cohort_modules").select("id, name, sort").eq("cohort_id", id).order("sort").order("created_at"),
    supabase.from("cohort_sessions").select("id, session_date, canceled, note").eq("cohort_id", id).order("session_date"),
  ]);
  const mods = modules ?? [];
  const sess = sessions ?? [];
  const name = (r: { first_name: string; last_name: string }) => `${r.first_name} ${r.last_name}`.trim();
  const rows: RosterRow[] = roster.map((r) => {
    const s = stats.get(r.id);
    return {
      id: r.id,
      name: name(r),
      email: r.email,
      status: r.status,
      grade: s?.grade ?? null,
      graded: s?.graded ?? 0,
      attendance: s?.attendance ?? null,
      present: s?.present ?? 0,
      late: s?.late ?? 0,
      absent: s?.absent ?? 0,
      excused: s?.excused ?? 0,
      lowGrade: s?.lowGrade ?? false,
      lowAttendance: s?.lowAttendance ?? false,
      atRisk: s?.atRisk ?? false,
    };
  });
  const atRisk = rows.filter((r) => r.atRisk).length;
  const phase = cohortPhase(cohort, today);
  const held = sess.filter((s) => !s.canceled && s.session_date <= today).length;

  // Tab data
  let grades: Record<string, number> = {};
  if (tab === "grades" && mods.length) {
    const g = await fetchAll<{ module_id: string; application_id: string; score: number }>((from, to) =>
      supabase.from("module_grades").select("module_id, application_id, score").in("module_id", mods.map((m) => m.id)).range(from, to),
    );
    grades = Object.fromEntries(g.map((x) => [`${x.module_id}:${x.application_id}`, Number(x.score)]));
  }
  let selected: (typeof sess)[number] | undefined;
  let marks: Record<string, AttendanceStatus> = {};
  let recordedBySession = new Map<string, number>();
  if (tab === "attendance" && sess.length) {
    const active = sess.filter((s) => !s.canceled);
    selected =
      sess.find((s) => s.id === sp.session) ??
      active.find((s) => s.session_date === today) ??
      [...active].reverse().find((s) => s.session_date <= today) ??
      active[0] ??
      sess[0];
    const [{ data: m }, all] = await Promise.all([
      supabase.from("session_attendance").select("application_id, status").eq("session_id", selected.id),
      fetchAll<{ session_id: string }>((from, to) => supabase.from("session_attendance").select("session_id").in("session_id", sess.map((s) => s.id)).range(from, to)),
    ]);
    marks = Object.fromEntries((m ?? []).map((x) => [x.application_id, x.status as AttendanceStatus]));
    recordedBySession = all.reduce((acc, x) => acc.set(x.session_id, (acc.get(x.session_id) ?? 0) + 1), new Map<string, number>());
  }
  const { data: announcements } =
    tab === "email" ? await supabase.from("cohort_announcements").select("id, subject, recipients, created_at").eq("cohort_id", id).order("created_at", { ascending: false }).limit(10) : { data: [] };

  return (
    <div>
      <Link href="/cohorts" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> All cohorts
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow={`${cohort.programs?.short_name ?? ""} · ${cohort.format}`} title={cohort.name} description={`${dateRange(cohort)} · ${cohort.location} · ${cohort.schedule}`} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Phase", <span key="p" className="text-base">{phase.label}</span>],
          ["Trainees", rows.length],
          ["Avg grade", <Pct key="g" value={avg(rows.flatMap((r) => (r.grade === null ? [] : [r.grade])))} kind="grade" className="text-2xl" />],
          ["Avg attendance", <Pct key="a" value={avg(rows.flatMap((r) => (r.attendance === null ? [] : [r.attendance])))} kind="attendance" className="text-2xl" />],
          ["At risk", <span key="r" className={atRisk ? "text-red-700" : ""}>{atRisk}</span>],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-ink/10 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-ink/10" aria-label="Sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/cohorts/${id}?tab=${t.key}`}
            className={cn("whitespace-nowrap rounded-full px-5 py-2 text-sm font-bold", tab === t.key ? "bg-ink text-white" : "text-ink/60 hover:bg-mist hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "roster" && (
        <>
          <p className="mb-3 text-sm text-ink/60">
            Highlighted in red: grade below {GRADE_MIN}% or attendance below {ATTENDANCE_MIN}%. Attendance counts {held} session{held === 1 ? "" : "s"} held so far
            (Late counts as present; Excused isn&apos;t counted). Select students to email them.
          </p>
          <RosterTable cohortId={id} rows={rows} moduleCount={mods.length} />
        </>
      )}

      {tab === "grades" && (
        <div className="grid gap-6">
          <Card>
            <h2 className="font-black">Modules ({mods.length})</h2>
            <p className="mt-1 text-sm text-ink/60">Each module gets one score per student. The overall grade is the average of the modules graded so far.</p>
            {mods.length > 0 && (
              <ul className="mt-4 divide-y divide-ink/5 rounded-xl border border-ink/10">
                {mods.map((m, i) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <ActionForm action={renameModule} className="flex min-w-0 flex-1 items-center gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <span className="w-6 text-right text-xs font-bold text-ink/40">{i + 1}.</span>
                      <Input name="name" defaultValue={m.name} maxLength={120} className="h-9 flex-1" aria-label={`Module ${i + 1} name`} />
                      <SubmitButton size="sm" variant="ghost" pendingText="…">
                        Rename
                      </SubmitButton>
                    </ActionForm>
                    {(["up", "down"] as const).map((dir) => (
                      <ActionForm key={dir} action={moveModule}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <SubmitButton size="sm" variant="ghost" className="px-2 text-ink/50" pendingText="…" disabled={dir === "up" ? i === 0 : i === mods.length - 1}>
                          {dir === "up" ? <ArrowUp className="h-4 w-4" aria-label="Move up" /> : <ArrowDown className="h-4 w-4" aria-label="Move down" />}
                        </SubmitButton>
                      </ActionForm>
                    ))}
                    <ActionForm action={deleteModule} confirm={{ title: `Delete "${m.name}"?`, body: "All scores entered for this module are deleted too.", confirmLabel: "Delete module", tone: "danger" }}>
                      <input type="hidden" name="id" value={m.id} />
                      <SubmitButton size="sm" variant="ghost" className="px-2 text-red-700" pendingText="…">
                        <Trash2 className="h-4 w-4" aria-label="Delete module" />
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addModule} resetOnSuccess className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="cohort_id" value={id} />
              <div>
                <Label htmlFor="new-module">Add modules</Label>
                <Textarea id="new-module" name="name" required className="min-h-12 text-sm" placeholder={"One per line, e.g.\nElectrical fundamentals\nVacuum systems"} />
              </div>
              <SubmitButton size="sm" variant="dark" pendingText="Adding…">
                Add
              </SubmitButton>
            </ActionForm>
          </Card>
          <GradesGrid cohortId={id} students={rows.map((r) => ({ id: r.id, name: r.name }))} modules={mods} initial={grades} />
        </div>
      )}

      {tab === "attendance" && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Card className="h-fit p-0">
            <div className="border-b border-ink/10 p-4">
              <h2 className="font-black">Sessions ({sess.filter((s) => !s.canceled).length})</h2>
              <p className="text-xs text-ink/50">{held} held so far</p>
            </div>
            {sess.length === 0 ? (
              <div className="p-4 text-sm text-ink/60">
                <p>No class sessions yet.</p>
                <ActionForm action={createSessionsFromSchedule} className="mt-3">
                  <input type="hidden" name="cohort_id" value={id} />
                  <SubmitButton size="sm" variant="dark" pendingText="Creating…">
                    <CalendarPlus className="h-4 w-4" aria-hidden /> Create from schedule
                  </SubmitButton>
                </ActionForm>
                <p className="mt-2 text-xs text-ink/50">Uses the cohort&apos;s dates and meeting days ({cohort.schedule}).</p>
              </div>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto py-1 text-sm">
                {sess.map((s) => {
                  const n = recordedBySession.get(s.id) ?? 0;
                  const future = s.session_date > today;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/cohorts/${id}?tab=attendance&session=${s.id}`}
                        className={cn("flex items-center justify-between gap-2 px-4 py-2 hover:bg-mist", selected?.id === s.id && "bg-gold/15 font-bold")}
                      >
                        <span className={cn(s.canceled && "text-ink/40 line-through")}>
                          {new Date(`${s.session_date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} {shortDate(s.session_date)}
                          {s.session_date === today && <span className="ml-1 text-xs font-bold text-maroon">Today</span>}
                        </span>
                        {s.canceled ? (
                          <span className="text-[11px] text-ink/40">Canceled</span>
                        ) : n > 0 ? (
                          <span className="text-[11px] font-bold text-emerald-700">✓ {n}</span>
                        ) : (
                          <span className={cn("text-[11px]", future ? "text-ink/30" : "font-bold text-amber-700")}>{future ? "Upcoming" : "Not taken"}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <ActionForm action={addSession} resetOnSuccess className="grid gap-2 border-t border-ink/10 p-4">
              <input type="hidden" name="cohort_id" value={id} />
              <Label htmlFor="add-session">Add a session (e.g. a make-up day)</Label>
              <Input id="add-session" name="date" type="date" required />
              <SubmitButton size="sm" variant="outline" pendingText="Adding…">
                Add session
              </SubmitButton>
            </ActionForm>
          </Card>
          <div className="grid content-start gap-4">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-black">
                    {new Date(`${selected.session_date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
                    {selected.canceled && <Badge tone="neutral" className="ml-2">Canceled</Badge>}
                  </h2>
                  <ActionForm
                    action={setSessionCanceled}
                    confirm={selected.canceled ? undefined : { title: "Cancel this session?", body: "Canceled sessions (holidays, closures) don't count toward attendance. Any attendance taken is kept but ignored.", confirmLabel: "Cancel session" }}
                  >
                    <input type="hidden" name="id" value={selected.id} />
                    <input type="hidden" name="canceled" value={selected.canceled ? "false" : "true"} />
                    <SubmitButton size="sm" variant="ghost" className="text-ink/60" pendingText="…">
                      {selected.canceled ? "Restore session" : "Cancel session (no class)"}
                    </SubmitButton>
                  </ActionForm>
                </div>
                {selected.canceled ? (
                  <p className="rounded-2xl bg-white p-6 text-sm text-ink/60">This session is canceled and doesn&apos;t count toward attendance.</p>
                ) : (
                  <AttendanceSheet
                    cohortId={id}
                    sessionId={selected.id}
                    students={rows.map((r) => ({ id: r.id, name: r.name, attendance: r.attendance, lowAttendance: r.lowAttendance }))}
                    initial={marks}
                  />
                )}
              </>
            ) : (
              <p className="rounded-2xl bg-white p-6 text-sm text-ink/60">Create the class sessions to start taking attendance.</p>
            )}
          </div>
        </div>
      )}

      {tab === "email" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card>
            <h2 className="font-black">Email students</h2>
            <p className="mt-1 text-sm text-ink/60">To email specific students, select them on the Roster tab.</p>
            <ActionForm action={emailStudents} resetOnSuccess className="mt-4 grid gap-3">
              <input type="hidden" name="cohort_id" value={id} />
              <div>
                <Label htmlFor="em-aud">Send to</Label>
                <Select id="em-aud" name="audience" defaultValue="all">
                  <option value="all">Everyone in the cohort ({rows.length}), also posted as an announcement</option>
                  <option value="at_risk">At-risk students only ({atRisk})</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="em-subject">Subject</Label>
                <Input id="em-subject" name="subject" required minLength={3} maxLength={150} />
              </div>
              <div>
                <Label htmlFor="em-body">Message</Label>
                <Textarea id="em-body" name="body" required minLength={3} maxLength={5000} className="min-h-40" placeholder="Blank lines start a new paragraph." />
              </div>
              <SubmitButton variant="dark" className="justify-self-start" pendingText="Sending…">
                Send email
              </SubmitButton>
            </ActionForm>
          </Card>
          <Card className="h-fit">
            <h2 className="font-black">Recent announcements</h2>
            {(announcements ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-ink/50">None yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {(announcements ?? []).map((a) => (
                  <li key={a.id} className="rounded-xl bg-mist p-3">
                    <p className="font-bold">{a.subject}</p>
                    <p className="text-xs text-ink/50">
                      {formatDateTime(a.created_at)} · {a.recipients} recipients
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
