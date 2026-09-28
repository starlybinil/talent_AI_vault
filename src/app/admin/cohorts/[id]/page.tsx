import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Megaphone, Phone, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { CohortForm } from "@/components/admin/CohortForm";
import { SeatsBar } from "@/components/program/CohortCard";
import { assignInstructor, deleteCohort, promoteWaitlist, sendCohortAnnouncement, unassignInstructor } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, EmptyState, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import type { CohortAvailability } from "@/lib/data";
import { STATUS_LABEL, STATUS_TONE, type Status } from "@/lib/workflow";
import { programProgress, todayInArizona } from "@/lib/schedule";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Cohort roster" };

type Enr = {
  status: string;
  waitlist_position: number | null;
  created_at: string;
  applications: { id: string; first_name: string; last_name: string; email: string; status: Status } | null;
};

type Member = {
  id: string;
  status: Status;
  assigned_cohort_id: string | null;
  left_cohort_id: string | null;
  leave_reasons: string[] | null;
};
type Person = { id: string; name: string; title: string; email: string | null; phone: string | null };
type Instructor = { id: string; role: string; instructors: Person | null };
type Announcement = { id: string; subject: string; body: string; audience: "trainees" | "all_placed"; recipients: number; created_at: string };

const AWAITING: Status[] = ["cohort_registered", "agreements_pending", "agreements_submitted"];

function Tile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : "text-ink";
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums tracking-tight ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}

export default async function CohortDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("cohorts.manage", `/admin/cohorts/${id}`);
  const supabase = await createClient();
  const { data: cohort } = await supabase.from("cohorts").select("*").eq("id", id).maybeSingle();
  if (!cohort) notFound();
  const [{ data: avail }, { data: enr }, { data: programs }, { data: locations }, { data: members }, { data: instructors }, { data: announcements }, { data: directory }] = await Promise.all([
    supabase.rpc("cohort_availability", { p_program: cohort.program_id }),
    supabase
      .from("cohort_enrollments")
      .select("status, waitlist_position, created_at, applications(id, first_name, last_name, email, status)")
      .eq("cohort_id", id)
      .in("status", ["registered", "waitlisted"])
      .order("waitlist_position", { ascending: true, nullsFirst: true }),
    supabase.from("programs").select("id, short_name, formats").order("sort"),
    supabase.from("training_locations").select("id, name, address, active").order("name"),
    supabase
      .from("applications")
      .select("id, status, assigned_cohort_id, left_cohort_id, leave_reasons")
      .or(`assigned_cohort_id.eq.${id},left_cohort_id.eq.${id}`),
    supabase.from("cohort_instructors").select("id, role, instructors(id, name, title, email, phone)").eq("cohort_id", id).order("sort").order("created_at"),
    supabase.from("cohort_announcements").select("id, subject, body, audience, recipients, created_at").eq("cohort_id", id).order("created_at", { ascending: false }),
    supabase.from("instructors").select("id, name, title").eq("active", true).order("name"),
  ]);
  const a = ((avail ?? []) as CohortAvailability[]).find((x) => x.cohort_id === id);
  const rows = (enr ?? []) as unknown as Enr[];
  const registered = rows.filter((r) => r.status === "registered");
  const waitlist = rows.filter((r) => r.status === "waitlisted");
  const people = (members ?? []) as Member[];
  const inCohort = people.filter((m) => m.assigned_cohort_id === id);
  const enrolled = inCohort.filter((m) => m.status === "confirmed").length;
  const awaiting = inCohort.filter((m) => AWAITING.includes(m.status)).length;
  const completed = inCohort.filter((m) => m.status === "completed" || m.status === "hired").length;
  const hired = inCohort.filter((m) => m.status === "hired").length;
  const left = people.filter((m) => m.left_cohort_id === id && m.status === "withdrawn");
  const started = enrolled + completed + left.length;
  const retention = started ? Math.round(((enrolled + completed) / started) * 100) : null;
  const reasonTally = Object.entries(
    left.flatMap((m) => m.leave_reasons ?? []).reduce<Record<string, number>>((acc, r) => ((acc[r] = (acc[r] ?? 0) + 1), acc), {}),
  ).sort((x, y) => y[1] - x[1]);
  const progress = programProgress(cohort.start_date, cohort.end_date, todayInArizona());
  const phaseText =
    progress.phase === "upcoming"
      ? `Starts in ${progress.daysUntil} day${progress.daysUntil === 1 ? "" : "s"}`
      : progress.phase === "running"
        ? `Week ${progress.week} of ${progress.weeks} · ${progress.pct}%`
        : "Finished";
  const staff = ((instructors ?? []) as unknown as Instructor[]).filter((t) => t.instructors);
  const assignable = (directory ?? []).filter((d) => !staff.some((t) => t.instructors?.id === d.id));
  const posts = (announcements ?? []) as Announcement[];
  const formats = Array.from(new Set((programs ?? []).flatMap((p) => ((p.formats as Array<{ name: string }>) ?? []).map((f) => f.name))));

  const Roster = ({ items, wl }: { items: Enr[]; wl?: boolean }) =>
    items.length === 0 ? (
      <EmptyState title={wl ? "Nobody is waiting" : "No one registered yet"} />
    ) : (
      <ul className="divide-y divide-ink/5">
        {items.map((r) => (
          <li key={r.applications?.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span>
              {wl && <strong className="mr-2 text-maroon">#{r.waitlist_position}</strong>}
              <Link href={`/admin/applications/${r.applications?.id}`} className="font-bold hover:text-maroon">
                {r.applications?.first_name} {r.applications?.last_name}
              </Link>
              <span className="block text-xs text-ink/50">{r.applications?.email}</span>
            </span>
            {r.applications && <Badge tone={STATUS_TONE[r.applications.status]}>{STATUS_LABEL[r.applications.status]}</Badge>}
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      <Link href="/admin/cohorts" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> All cohorts
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow={cohort.format} title={cohort.name} />
      </div>
      {a && (
        <Card className="mb-6">
          <SeatsBar c={a} />
        </Card>
      )}
      <Card className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-black">Cohort at a glance</h2>
          <p className="text-sm text-ink/60">
            {formatDate(cohort.start_date)} – {formatDate(cohort.end_date)} · {cohort.location}
          </p>
        </div>
        {progress.phase === "running" && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist" aria-hidden>
            <div className="h-full rounded-full bg-maroon" style={{ width: `${progress.pct}%` }} />
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Tile label="Phase" value={progress.phase === "running" ? `${progress.pct}%` : progress.phase === "upcoming" ? "Upcoming" : "Finished"} hint={phaseText} />
          <Tile label="Currently enrolled" value={enrolled} hint="Confirmed trainees still in the cohort" tone="good" />
          <Tile label="Awaiting confirmation" value={awaiting} hint="Holding a seat, agreements in progress" />
          <Tile label="Waitlist" value={waitlist.length} />
          <Tile label="Seats left" value={a ? `${a.seats_left} / ${cohort.capacity}` : cohort.capacity} />
          <Tile label="Left the program" value={left.length} tone={left.length ? "bad" : undefined} />
          <Tile label="Retention" value={retention === null ? "—" : `${retention}%`} hint={started ? `${enrolled + completed} of ${started} who started` : "No trainees yet"} tone={retention !== null && retention < 80 ? "warn" : undefined} />
          <Tile label="Completed · hired" value={`${completed} · ${hired}`} />
        </div>
        {reasonTally.length > 0 && (
          <div className="mt-4 rounded-2xl bg-mist p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink/50">Why trainees left</p>
            <ul className="mt-2 space-y-1 text-sm">
              {reasonTally.map(([reason, n]) => (
                <li key={reason} className="flex justify-between gap-3">
                  <span>{reason}</span>
                  <strong className="tabular-nums">{n}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Megaphone className="h-5 w-5 text-maroon" aria-hidden /> Message this cohort
          </h2>
          <p className="mt-1 text-sm text-ink/60">Emails everyone placed in this cohort. It also appears on their In program tab.</p>
          <ActionForm
            action={sendCohortAnnouncement}
            resetOnSuccess
            className="mt-4 grid gap-3"
            confirm={{
              title: "Send this announcement?",
              body: "It's emailed right away to everyone in the audience you picked and can't be unsent.",
              points: [`Currently enrolled: ${enrolled}`, `Awaiting confirmation: ${awaiting}`],
              confirmLabel: "Send announcement",
              cancelLabel: "Keep editing",
            }}
          >
            <input type="hidden" name="cohort_id" value={id} />
            <div className="grid gap-1.5">
              <Label htmlFor="ann-audience">Send to</Label>
              <Select id="ann-audience" name="audience" defaultValue="trainees">
                <option value="trainees">Enrolled trainees ({enrolled})</option>
                <option value="all_placed">Enrolled + awaiting confirmation ({enrolled + awaiting})</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ann-subject">Subject</Label>
              <Input id="ann-subject" name="subject" required minLength={3} maxLength={150} placeholder="e.g. Lab moves to Building B on Monday" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ann-body">Message</Label>
              <Textarea id="ann-body" name="body" required minLength={3} maxLength={5000} className="min-h-40" placeholder="Write your update. Blank lines start a new paragraph." />
            </div>
            <SubmitButton size="sm" className="justify-self-start" pendingText="Sending…">
              <Mail className="h-4 w-4" aria-hidden /> Send announcement
            </SubmitButton>
          </ActionForm>
          <h3 className="mt-6 text-sm font-black uppercase tracking-wider text-ink/50">Sent ({posts.length})</h3>
          {posts.length === 0 ? (
            <p className="mt-2 text-sm text-ink/50">No announcements yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {posts.map((p) => (
                <li key={p.id}>
                  <details className="group rounded-xl border border-ink/10 p-3">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-bold">{p.subject}</span>
                        <span className="text-xs text-ink/50">
                          {new Date(p.created_at).toLocaleString("en-US", { timeZone: "America/Phoenix", dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </span>
                      <Badge tone="neutral">
                        {p.recipients} · {p.audience === "trainees" ? "trainees" : "all placed"}
                      </Badge>
                    </summary>
                    <p className="mt-3 whitespace-pre-line text-sm text-ink/80">{p.body}</p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-black">Instructors ({staff.length})</h2>
            <Link href="/admin/instructors" className="text-xs font-bold text-maroon hover:underline">
              Instructor directory →
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink/60">Shown to enrolled trainees on their In program tab.</p>
          {staff.length === 0 ? (
            <p className="mt-4 text-sm text-ink/50">No instructors assigned yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-ink/5">
              {staff.map(({ id: linkId, role, instructors: t }) => (
                <li key={linkId} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <strong className="block">{t!.name}</strong>
                    <span className="text-xs font-bold text-maroon">{role}</span>
                    {t!.email && (
                      <a href={`mailto:${t!.email}`} className="mt-1 flex items-center gap-1 break-all text-xs text-ink/60 hover:text-maroon">
                        <Mail className="h-3 w-3 shrink-0" aria-hidden /> {t!.email}
                      </a>
                    )}
                    {t!.phone && (
                      <span className="flex items-center gap-1 text-xs text-ink/60">
                        <Phone className="h-3 w-3 shrink-0" aria-hidden /> {t!.phone}
                      </span>
                    )}
                  </span>
                  <ActionForm action={unassignInstructor} confirm={`Unassign ${t!.name} from this cohort? They stay in the instructor directory.`}>
                    <input type="hidden" name="id" value={linkId} />
                    <SubmitButton size="sm" variant="ghost" className="text-ink/50" pendingText="…">
                      Unassign
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
          {assignable.length > 0 ? (
            <ActionForm action={assignInstructor} className="mt-4 grid gap-2 rounded-2xl bg-mist p-4">
              <input type="hidden" name="cohort_id" value={id} />
              <p className="text-xs font-bold uppercase tracking-wider text-ink/50">Assign an instructor</p>
              <Select name="instructor_id" required defaultValue="" aria-label="Instructor">
                <option value="" disabled>
                  Choose from the directory…
                </option>
                {assignable.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.title}
                  </option>
                ))}
              </Select>
              <Input name="role" maxLength={80} placeholder="Role in this cohort (defaults to their title)" aria-label="Role in this cohort" />
              <SubmitButton size="sm" variant="outline" className="justify-self-start" pendingText="Assigning…">
                <UserPlus className="h-4 w-4" aria-hidden /> Assign
              </SubmitButton>
            </ActionForm>
          ) : (
            <p className="mt-4 rounded-2xl bg-mist p-4 text-sm text-ink/60">
              {staff.length ? "Everyone in the directory is assigned. " : ""}
              <Link href="/admin/instructors" className="font-bold text-maroon hover:underline">
                Add instructors to the directory
              </Link>{" "}
              to assign them here.
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-black">Registered ({registered.length})</h2>
          <Roster items={registered} />
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-black">Waitlist ({waitlist.length})</h2>
            <ActionForm action={promoteWaitlist}>
              <input type="hidden" name="cohort_id" value={id} />
              <SubmitButton size="sm" variant="outline" pendingText="Promoting…">
                Fill open seats
              </SubmitButton>
            </ActionForm>
          </div>
          <Roster items={waitlist} wl />
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="mb-5 text-lg font-black">Edit cohort</h2>
        <CohortForm cohort={cohort} programs={programs ?? []} formats={formats} locations={locations ?? []} />
      </Card>
      <Card className="mt-6 border-red-200">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">Danger zone</p>
        <h2 className="mt-1 text-lg font-black">Delete this cohort</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink/70">
          Permanently removes the cohort from the schedule.{" "}
          {registered.length + waitlist.length > 0
            ? `${registered.length} registered and ${waitlist.length} waitlisted applicant(s) are affected. Anyone left without a seat or another waitlist spot is emailed and sent back to choose new cohorts, and their signed agreements are cleared.`
            : "Nobody is registered or waitlisted, so no applicants are affected."}{" "}
          To just stop new sign-ups, set the status to Closed instead.
        </p>
        <ActionForm
          action={deleteCohort}
          className="mt-4 grid max-w-2xl gap-3"
          confirm={{
            title: `Delete "${cohort.name}"?`,
            body: "This permanently removes the cohort and can't be undone.",
            points: [
              ...(registered.length ? [`${registered.length} registered applicant(s) lose their seat and go back to choosing cohorts.`] : []),
              ...(waitlist.length ? [`${waitlist.length} waitlisted applicant(s) are removed from this waitlist.`] : []),
              ...(registered.length + waitlist.length ? ["Anyone left without a seat or another waitlist spot is emailed and asked to choose new cohorts. Their signed agreements are cleared."] : []),
              "The cohort disappears from the public schedule and from applicants' choices.",
            ],
            confirmLabel: "Yes, delete cohort",
            cancelLabel: "Keep cohort",
            tone: "danger",
          }}
        >
          <input type="hidden" name="cohort_id" value={id} />
          {registered.length + waitlist.length > 0 && (
            <>
              <Label htmlFor="delete-note">Reason shared with affected applicants (optional)</Label>
              <Textarea id="delete-note" name="note" maxLength={500} placeholder="e.g. the venue is no longer available" className="min-h-16 text-sm" />
            </>
          )}
          <SubmitButton variant="danger" size="sm" className="justify-self-start" pendingText="Deleting…">
            <Trash2 className="h-4 w-4" aria-hidden /> Delete cohort
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
