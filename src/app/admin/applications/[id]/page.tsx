import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";
import { adminAct, adminMessage } from "@/app/admin/actions";
import { Timeline, type TimelineEvent } from "@/components/portal/Timeline";
import { StatusTracker } from "@/components/portal/StatusTracker";
import { MessageThread, type Message } from "@/components/portal/MessageThread";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Alert, Badge, Card, Input, Label, Select, Textarea } from "@/components/ui";
import type { CohortAvailability } from "@/lib/data";
import { EDUCATION_LABEL, STATUS_LABEL, STATUS_TONE, VISA_LABEL, canWithdraw, isTrainee, type Status } from "@/lib/workflow";
import { OutcomePanel } from "@/components/admin/OutcomePanel";
import { todayInArizona } from "@/lib/schedule";
import { formatDate, formatDateTime } from "@/lib/utils";
import { audit } from "@/lib/audit";

export const metadata = { title: "Application review" };

type Op = { op: string; label: string; variant?: "gold" | "dark" | "outline" | "danger"; confirm?: string; needsUrl?: boolean; needsCohort?: boolean };

function opsFor(status: Status, hasSeat: boolean): Op[] {
  const ops: Op[] = [];
  switch (status) {
    case "submitted":
      ops.push({ op: "start_screening", label: "Start screening", variant: "dark" });
      ops.push({ op: "pass_and_invite", label: "Pass screening & send assessment", needsUrl: true });
      ops.push({ op: "not_selected", label: "Not selected", variant: "outline", confirm: "Mark this applicant as not selected? They'll be emailed." });
      break;
    case "screening":
      ops.push({ op: "pass_and_invite", label: "Pass screening & send assessment", needsUrl: true });
      ops.push({ op: "pass_screening", label: "Pass screening only", variant: "dark" });
      ops.push({ op: "not_selected", label: "Not selected", variant: "outline", confirm: "Mark this applicant as not selected? They'll be emailed." });
      break;
    case "screening_passed":
      ops.push({ op: "send_invite", label: "Send assessment invite", needsUrl: true });
      break;
    case "exam_invited":
      ops.push({ op: "exam_passed", label: "Record: passed (TSMC verified)" });
      ops.push({ op: "exam_failed", label: "Record: not passed", variant: "outline", confirm: "Record a failing assessment result? The applicant will be emailed." });
      ops.push({ op: "send_reminder", label: "Send reminder email", variant: "dark" });
      break;
    case "exam_failed":
      ops.push({ op: "send_invite", label: "Re-invite to assessment", needsUrl: true, variant: "dark" });
      break;
    case "not_selected":
      ops.push({ op: "reconsider", label: "Reconsider (back to screening)", variant: "dark" });
      break;
    case "cohort_selection":
    case "waitlisted":
    case "cohort_registered":
    case "agreements_pending":
      ops.push({ op: "assign_cohort", label: hasSeat ? "Move to cohort" : "Assign cohort", needsCohort: true, variant: "dark" });
      if (hasSeat || status === "waitlisted") ops.push({ op: "release_seat", label: "Release seat & reopen selection", variant: "outline", confirm: "Release this applicant's seat? The next person on the waitlist will be promoted." });
      break;
    case "agreements_submitted":
      ops.push({ op: "confirm", label: "Confirm enrollment & send final confirmation" });
      ops.push({ op: "return_agreements", label: "Return agreements for correction", variant: "outline" });
      break;
  }
  if (canWithdraw(status)) ops.push({ op: "withdraw", label: "Withdraw application", variant: "danger", confirm: "Withdraw this application? Any seat is released to the waitlist." });
  return ops;
}

export default async function AdminApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePermission("admissions.read", `/admin/applications/${id}`);
  const canManage = can(session.roles, "admissions.manage");
  const supabase = await createClient();

  const { data: app } = await supabase.from("applications").select("*, programs(id, name, short_name, default_exam_url)").eq("id", id).maybeSingle();
  if (!app) notFound();
  const program = Array.isArray(app.programs) ? app.programs[0] : app.programs;
  const status = app.status as Status;

  const [
    { data: events },
    { data: messages },
    { data: prefs },
    { data: enrollments },
    { data: sigs },
    { data: templates },
    { data: emails },
    { data: employerNotes },
    cohortsRes,
    { data: employers },
  ] = await Promise.all([
      supabase.from("application_events").select("id, to_status, note, created_at, actor_id").eq("application_id", id).order("created_at"),
      supabase.from("messages").select("id, body, internal, created_at, sender_id").eq("application_id", id).order("created_at"),
      supabase.from("cohort_preferences").select("cohort_id, rank").eq("application_id", id).order("rank"),
      supabase.from("cohort_enrollments").select("cohort_id, status, waitlist_position").eq("application_id", id),
      supabase.from("agreement_signatures").select("template_id, template_version, typed_name, signed_at, ip, pdf_path").eq("application_id", id),
      supabase.from("agreement_templates").select("id, title, version, required").eq("program_id", program!.id).eq("active", true).order("sort"),
      supabase.from("email_log").select("id, template, subject, status, created_at").eq("application_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("employer_notes").select("id, kind, body, created_at, employer_orgs(name)").eq("application_id", id).order("created_at", { ascending: false }),
      supabase.rpc("cohort_availability", { p_program: program!.id }),
      isTrainee(status) ? supabase.from("employer_orgs").select("id, name").order("name") : Promise.resolve({ data: [] }),
    ]);

  // Resolve staff names for timeline/messages (staff can read profiles).
  const actorIds = Array.from(new Set([...(events ?? []).map((e) => e.actor_id), ...(messages ?? []).map((m) => m.sender_id)].filter(Boolean))) as string[];
  const { data: people } = actorIds.length ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds) : { data: [] };
  const nameOf = (uid: string | null) => {
    if (!uid) return "System";
    if (uid === app.user_id) return `${app.first_name} (applicant)`;
    const p = (people ?? []).find((x) => x.id === uid);
    return p?.full_name || p?.email || "Staff";
  };

  const cohorts = (cohortsRes.data ?? []) as CohortAvailability[];
  const cohortById = Object.fromEntries(cohorts.map((c) => [c.cohort_id, c]));
  const hasSeat = (enrollments ?? []).some((e) => e.status === "registered");
  const ops = canManage ? opsFor(status, hasSeat) : [];
  const sigByTpl = new Map((sigs ?? []).map((s) => [s.template_id, s]));

  await audit(supabase, "application.view", "application", id);

  return (
    <div>
      <Link href="/admin/applications" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> Back to queue
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maroon">{program?.short_name}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            {app.first_name} {app.last_name}
          </h1>
          <p className="text-sm text-ink/60">
            {app.email} · {app.phone} · Applied {formatDate(app.submitted_at)}
            {app.utm_source ? ` · via ${app.utm_source}` : ""}
          </p>
        </div>
        <Badge tone={STATUS_TONE[status]} className="self-start text-sm">
          {STATUS_LABEL[status]}
        </Badge>
      </div>

      <Card className="mt-6">
        <StatusTracker status={status} />
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="grid content-start gap-6">
          <Card>
            <h2 className="font-black">Application</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                ["Highest diploma/degree", EDUCATION_LABEL[app.highest_education]],
                ["Major", app.major || "—"],
                ["Visa sponsorship (now/future)", VISA_LABEL[app.visa_sponsorship]],
                ["18+ by completion", app.will_be_18_by_completion ? "Yes" : "No"],
                ["Shares with employers", app.share_with_employers ? "Yes" : "No"],
                ["Assessment", app.exam_result ? app.exam_result : app.exam_invited_at ? `Invited ${formatDate(app.exam_invited_at)}${app.exam_self_reported_at ? " · applicant says complete" : ""}${app.exam_reminders_sent ? ` · ${app.exam_reminders_sent} reminder(s)` : ""}` : "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-bold uppercase tracking-wider text-ink/50">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {!app.will_be_18_by_completion && (
              <Alert tone="warn" className="mt-4">
                Applicant indicated they will <strong>not</strong> be 18 by program completion.
              </Alert>
            )}
            {app.resume_path && (
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`/api/files?path=${encodeURIComponent(app.resume_path)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-maroon">
                  <FileText className="h-4 w-4" /> Open resume
                </a>
                <a href={`/api/files?path=${encodeURIComponent(app.resume_path)}&download=1`} className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-sm font-bold hover:border-ink">
                  <Download className="h-4 w-4" /> Download
                </a>
              </div>
            )}
          </Card>

          {((prefs ?? []).length > 0 || (enrollments ?? []).length > 0) && (
            <Card>
              <h2 className="font-black">Cohort choices</h2>
              <ul className="mt-4 divide-y divide-ink/5">
                {(prefs ?? []).map((p) => {
                  const c = cohortById[p.cohort_id];
                  const e = (enrollments ?? []).find((x) => x.cohort_id === p.cohort_id);
                  return (
                    <li key={p.cohort_id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span>
                        <strong>#{p.rank}</strong> {c?.name} <span className="text-ink/50">· {c?.seats_left} seats left</span>
                      </span>
                      {e && <Badge tone={e.status === "registered" ? "success" : e.status === "waitlisted" ? "warn" : "neutral"}>{e.status === "waitlisted" ? `Waitlist #${e.waitlist_position}` : e.status}</Badge>}
                    </li>
                  );
                })}
                {(enrollments ?? [])
                  .filter((e) => !(prefs ?? []).some((p) => p.cohort_id === e.cohort_id))
                  .map((e) => (
                    <li key={e.cohort_id} className="flex items-center justify-between py-3 text-sm">
                      <span>{cohortById[e.cohort_id]?.name} <span className="text-ink/50">(assigned by admissions)</span></span>
                      <Badge tone={e.status === "registered" ? "success" : "neutral"}>{e.status}</Badge>
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          {(["agreements_pending", "agreements_submitted"].includes(status) || isTrainee(status)) && (
            <Card>
              <h2 className="font-black">Program agreements</h2>
              <ul className="mt-4 divide-y divide-ink/5">
                {(templates ?? []).map((t) => {
                  const s = sigByTpl.get(t.id);
                  const current = s && s.template_version === t.version;
                  return (
                    <li key={t.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-bold">
                        {t.title} <span className="font-normal text-ink/50">v{t.version}</span>
                      </span>
                      {current ? (
                        <span className="flex items-center gap-3">
                          <span className="text-ink/60">
                            {s.typed_name} · {formatDateTime(s.signed_at)} · IP {s.ip ?? "?"}
                          </span>
                          {s.pdf_path && (
                            <a className="font-bold text-maroon hover:underline" href={`/api/files?path=${encodeURIComponent(s.pdf_path)}`} target="_blank" rel="noopener noreferrer">
                              PDF
                            </a>
                          )}
                        </span>
                      ) : (
                        <Badge tone="warn">Not signed</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="font-black">Messages & internal notes</h2>
            <div className="mt-4">
              <MessageThread
                viewerId={session.userId}
                messages={((messages ?? []) as Message[]).map((m) => ({ ...m, sender_name: nameOf(m.sender_id) }))}
              />
            </div>
            {canManage && (
              <ActionForm action={adminMessage} resetOnSuccess className="mt-5 grid gap-3">
                <input type="hidden" name="application_id" value={app.id} />
                <Textarea name="body" required placeholder="Write to the applicant, or leave an internal note…" aria-label="Message" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" name="internal" className="h-4 w-4 accent-maroon" /> Internal note (applicant can&apos;t see)
                  </label>
                  <SubmitButton size="sm" variant="dark" pendingText="Sending…">
                    Send
                  </SubmitButton>
                </div>
              </ActionForm>
            )}
          </Card>

          {(employerNotes ?? []).length > 0 && (
            <Card>
              <h2 className="font-black">Employer partner feedback</h2>
              <ul className="mt-4 space-y-3">
                {(employerNotes ?? []).map((n) => {
                  const org = Array.isArray(n.employer_orgs) ? n.employer_orgs[0] : n.employer_orgs;
                  return (
                    <li key={n.id} className="rounded-xl bg-mist p-3 text-sm">
                      <p className="text-xs font-bold text-ink/50">
                        {org?.name} · {n.kind.replace(/_/g, " ")} · {formatDateTime(n.created_at)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          {isTrainee(status) && (
            <OutcomePanel
              appId={app.id}
              status={status}
              outcome={app}
              canManage={canManage}
              employers={(employers ?? []) as Array<{ id: string; name: string }>}
              defaultCompletionDate={
                app.assigned_cohort_id && cohortById[app.assigned_cohort_id]?.end_date
                  ? [cohortById[app.assigned_cohort_id].end_date, todayInArizona()].sort()[0]
                  : todayInArizona()
              }
            />
          )}
          {canManage && ops.length > 0 && (
            <Card className="border-maroon/30">
              <h2 className="font-black">Move through the workflow</h2>
              <p className="mt-1 text-sm text-ink/60">The applicant sees each change in their portal and gets an email.</p>
              <div className="mt-5 space-y-4">
                {ops.map((o) => (
                  <ActionForm key={o.op} action={adminAct} confirm={o.confirm} className="rounded-2xl border border-ink/10 p-4">
                    <input type="hidden" name="application_id" value={app.id} />
                    <input type="hidden" name="op" value={o.op} />
                    {o.needsUrl && (
                      <div className="mb-3">
                        <Label htmlFor={`url-${o.op}`}>TestGorilla link</Label>
                        <Input id={`url-${o.op}`} name="exam_url" type="url" defaultValue={app.exam_url ?? program?.default_exam_url ?? ""} placeholder="https://app.testgorilla.com/…" />
                      </div>
                    )}
                    {o.needsCohort && (
                      <div className="mb-3">
                        <Label htmlFor={`cohort-${o.op}`}>Cohort</Label>
                        <Select id={`cohort-${o.op}`} name="cohort_id" defaultValue={app.assigned_cohort_id ?? ""} required>
                          <option value="">Choose…</option>
                          {cohorts
                            .filter((c) => c.status === "open")
                            .map((c) => (
                              <option key={c.cohort_id} value={c.cohort_id} disabled={c.seats_left === 0 && c.cohort_id !== app.assigned_cohort_id}>
                                {c.name} — {c.seats_left} left
                              </option>
                            ))}
                        </Select>
                      </div>
                    )}
                    {o.op !== "send_reminder" && (
                      <Textarea name="note" placeholder="Optional note to the applicant (included in the email)" className="mb-3 min-h-16 text-sm" aria-label="Note" />
                    )}
                    <SubmitButton variant={o.variant ?? "gold"} size="sm" className="w-full" pendingText="Updating…">
                      {o.label}
                    </SubmitButton>
                  </ActionForm>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="font-black">Timeline</h2>
            <div className="mt-5">
              <Timeline showActor events={((events ?? []) as Array<TimelineEvent & { actor_id: string | null }>).map((e) => ({ ...e, actor_name: nameOf(e.actor_id) }))} />
            </div>
          </Card>

          <Card>
            <h2 className="font-black">Emails sent</h2>
            {(emails ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">None yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink/5 text-sm">
                {(emails ?? []).map((e) => (
                  <li key={e.id} className="py-2">
                    <p className="font-bold">{e.subject}</p>
                    <p className="text-xs text-ink/50">
                      {formatDateTime(e.created_at)} · <span className={e.status === "failed" ? "text-red-700" : ""}>{e.status}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
