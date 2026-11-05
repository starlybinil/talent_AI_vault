import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { adjustCheckin, markRestAbsent, reviewCheckin } from "@/app/sessions/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AttendanceSheet, FLAG_LABEL, type MarkDetail } from "@/components/tracking/AttendanceSheet";
import { StartCheckin } from "@/components/checkin/StartCheckin";
import { LiveRefresh } from "@/components/checkin/LiveRefresh";
import { isOpen, loadSessionContext } from "@/lib/checkin-data";
import { ATTENDANCE_LABEL, type AttendanceStatus } from "@/lib/tracking";
import { todayInArizona } from "@/lib/schedule";

export const metadata = { title: "Class session" };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" });
const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/sessions/${id}`);
  const supabase = await createClient();
  const ctx = await loadSessionContext(supabase, id);
  if (!ctx) notFound();
  const { session, cohort, manages, canRun, roster, stats, marks, window, program } = ctx;
  const today = todayInArizona();
  const open = isOpen(window);
  const isToday = session.session_date === today;
  const canEdit = manages || (ctx.teaches && isToday);
  const { data: loc } = await supabase.from("cohorts").select("training_locations(latitude, longitude)").eq("id", cohort.id).maybeSingle();
  const tl = (Array.isArray(loc?.training_locations) ? loc?.training_locations[0] : loc?.training_locations) as { latitude: number | null; longitude: number | null } | null;
  const markBy = new Map(marks.map((m) => [m.application_id, m]));
  const unmarked = roster.filter((r) => !markBy.has(r.id)).length;
  const flagged = marks.filter((m) => m.flag && !m.flag_reviewed_at);
  const qrCount = marks.filter((m) => m.source === "qr").length;
  const name = (r: { first_name: string; last_name: string }) => `${r.first_name} ${r.last_name}`;
  const back = manages ? { href: `/cohorts/${cohort.id}?tab=attendance&session=${id}`, label: cohort.name } : { href: "/teach", label: "Today" };

  const initial = Object.fromEntries(marks.map((m) => [m.application_id, m.status])) as Record<string, AttendanceStatus>;
  const details: Record<string, MarkDetail> = Object.fromEntries(
    marks.map((m) => [m.application_id, { qrTime: m.source === "qr" && m.checked_in_at ? time(m.checked_in_at) : null, flag: m.flag, reviewed: !!m.flag_reviewed_at }]),
  );

  return (
    <div>
      {open && window && <LiveRefresh windowId={window.id} />}
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> {back.label}
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow={`${cohort.programs?.short_name ?? ""} · ${cohort.name}`} title={longDate(session.session_date)} description={`${cohort.location} · ${cohort.schedule}`} />
      </div>

      {session.canceled ? (
        <Card>This session is canceled and doesn&apos;t count toward attendance.</Card>
      ) : (
        <div className="grid gap-6">
          <Card className={open ? "border-emerald-300 bg-emerald-50/40" : undefined}>
            {open && window ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Check-in is open</p>
                  <p className="mt-1 text-2xl font-black">
                    {qrCount} of {roster.length} checked in
                  </p>
                  <p className="text-sm text-ink/60">
                    Opened {time(window.opened_at)} · Late after {time(window.late_after)} · Closes {time(window.closes_at)}
                    {window.require_location && " · Location checked"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/sessions/${id}/screen`} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-maroon">
                    <Monitor className="h-4 w-4" aria-hidden /> Show QR screen
                  </Link>
                  {canRun &&
                    (["extend", "close"] as const).map((a) => (
                      <ActionForm key={a} action={adjustCheckin}>
                        <input type="hidden" name="window_id" value={window.id} />
                        <input type="hidden" name="session_id" value={id} />
                        <input type="hidden" name="action" value={a} />
                        <SubmitButton size="sm" variant={a === "close" ? "outline" : "ghost"} pendingText="…">
                          {a === "extend" ? "+5 minutes" : "Close check-in"}
                        </SubmitButton>
                      </ActionForm>
                    ))}
                </div>
              </div>
            ) : canRun ? (
              <>
                <h2 className="text-lg font-black">{window ? "Check-in closed" : "Take attendance with a QR code"}</h2>
                {window && (
                  <p className="mt-1 text-sm text-ink/60">
                    {qrCount} trainee{qrCount === 1 ? "" : "s"} checked in between {time(window.opened_at)} and {time(window.closed_at ?? window.closes_at)}. You can reopen it.
                  </p>
                )}
                <div className="mt-3">
                  <StartCheckin
                    sessionId={id}
                    needsLocation={!!program?.checkin_location}
                    hasSavedLocation={tl?.latitude != null && tl?.longitude != null}
                    windowMinutes={program?.checkin_window_minutes ?? 15}
                    lateMinutes={program?.checkin_late_minutes ?? 10}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-ink/60">
                {session.session_date > today
                  ? "Check-in can be started on the day of the session."
                  : "Check-in can only be started by instructors on the day of the session. The cohort manager can still update attendance."}
              </p>
            )}
          </Card>

          {canEdit && unmarked > 0 && (window || session.session_date <= today) && (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">
                  {unmarked} trainee{unmarked === 1 ? " hasn't" : "s haven't"} checked in
                </p>
                <p className="text-sm text-ink/60">When check-in is done, mark the rest Absent. Late arrivals can still be changed below.</p>
              </div>
              <ActionForm
                action={markRestAbsent}
                confirm={{
                  title: `Mark ${unmarked} trainee${unmarked === 1 ? "" : "s"} Absent?`,
                  body: "This closes check-in. Anyone who arrives later can still be changed to Late or Present on this page.",
                  confirmLabel: "Mark Absent",
                }}
                className="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="session_id" value={id} />
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" name="send_emails" defaultChecked={program?.missed_session_email ?? true} className="h-4 w-4 accent-maroon" />
                  Email them &ldquo;We missed you today&rdquo;
                </label>
                <SubmitButton size="sm" variant="dark" pendingText="Marking…">
                  Mark the rest Absent
                </SubmitButton>
              </ActionForm>
            </Card>
          )}

          {flagged.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/50">
              <h2 className="font-black">Needs review ({flagged.length})</h2>
              <p className="mt-1 text-sm text-ink/60">
                These check-ins count as {`Present/Late`} until {manages ? "you review them" : "the cohort manager reviews them"}.
              </p>
              <ul className="mt-3 divide-y divide-amber-200">
                {flagged.map((m) => {
                  const r = roster.find((x) => x.id === m.application_id);
                  return (
                    <li key={m.application_id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                      <span>
                        <strong>{r ? name(r) : "Trainee"}</strong> · {ATTENDANCE_LABEL[m.status]} {m.checked_in_at && `at ${time(m.checked_in_at)}`} ·{" "}
                        <span className="font-bold text-amber-900">
                          {FLAG_LABEL[m.flag!] ?? m.flag}
                          {m.distance_m != null && ` (${m.distance_m >= 1000 ? `${(m.distance_m / 1000).toFixed(1)} km` : `${m.distance_m} m`} away)`}
                        </span>
                      </span>
                      {manages && (
                        <span className="flex gap-2">
                          {(["keep", "absent"] as const).map((d) => (
                            <ActionForm key={d} action={reviewCheckin}>
                              <input type="hidden" name="session_id" value={id} />
                              <input type="hidden" name="application_id" value={m.application_id} />
                              <input type="hidden" name="decision" value={d} />
                              <SubmitButton size="sm" variant={d === "keep" ? "outline" : "ghost"} className={d === "absent" ? "text-red-700" : ""} pendingText="…">
                                {d === "keep" ? "Looks fine" : "Mark Absent"}
                              </SubmitButton>
                            </ActionForm>
                          ))}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black">Attendance</h2>
              {!canEdit && <Badge tone="neutral">View only: instructors can change attendance on the day of the session</Badge>}
            </div>
            <AttendanceSheet
              cohortId={cohort.id}
              sessionId={id}
              students={roster.map((r) => {
                const s = stats.get(r.id);
                return { id: r.id, name: name(r), attendance: s?.attendance ?? null, lowAttendance: s?.lowAttendance ?? false };
              })}
              initial={initial}
              details={details}
              prefillPresent={!window}
              readOnly={!canEdit}
              studentHrefPrefix={manages ? `/cohorts/${cohort.id}/students/` : `/teach/cohorts/${cohort.id}#`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
