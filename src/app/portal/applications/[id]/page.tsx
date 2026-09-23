import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileSignature, PartyPopper } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { StatusTracker } from "@/components/portal/StatusTracker";
import { Timeline, type TimelineEvent } from "@/components/portal/Timeline";
import { CohortPicker } from "@/components/portal/CohortPicker";
import { MarkExamComplete } from "@/components/portal/ExamActions";
import { SignaturePad } from "@/components/portal/SignaturePad";
import { MessageThread, type Message } from "@/components/portal/MessageThread";
import { CohortDetails } from "@/components/program/CohortCard";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Alert, Badge, ButtonLink, Card, Input, Label, Textarea } from "@/components/ui";
import { sendApplicantMessage, signAgreement, withdrawApplication } from "@/app/portal/actions";
import type { CohortAvailability } from "@/lib/data";
import {
  EDUCATION_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  VISA_LABEL,
  applicantNextAction,
  isTerminal,
  type Status,
} from "@/lib/workflow";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Application" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "exam", label: "Assessment" },
  { key: "cohorts", label: "Cohorts" },
  { key: "agreements", label: "Agreements" },
  { key: "messages", label: "Messages" },
  { key: "details", label: "My application" },
] as const;

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; submitted?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await requireSession(`/portal/applications/${id}`);
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("applications")
    .select("*, programs(id, slug, name, short_name)")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!app) notFound();

  const status = app.status as Status;
  const program = Array.isArray(app.programs) ? app.programs[0] : app.programs;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "overview";

  const [{ data: events }, { data: messages }, { data: enrollments }, { data: prefs }, { data: templates }, { data: signatures }, cohortsRes] =
    await Promise.all([
      supabase.from("application_events").select("id, to_status, note, created_at").eq("application_id", id).order("created_at"),
      supabase.from("messages").select("id, body, internal, created_at, sender_id").eq("application_id", id).order("created_at"),
      supabase.from("cohort_enrollments").select("cohort_id, status, waitlist_position").eq("application_id", id),
      supabase.from("cohort_preferences").select("cohort_id, rank").eq("application_id", id).order("rank"),
      supabase.from("agreement_templates").select("id, title, body, version, required, sort").eq("program_id", program!.id).eq("active", true).order("sort"),
      supabase.from("agreement_signatures").select("template_id, template_version, typed_name, signed_at, pdf_path").eq("application_id", id),
      supabase.rpc("cohort_availability", { p_program: program!.id }),
    ]);
  const cohorts = ((cohortsRes.data ?? []) as CohortAvailability[]).filter((c) => c.status === "open");
  const cohortById = Object.fromEntries(((cohortsRes.data ?? []) as CohortAvailability[]).map((c) => [c.cohort_id, c]));
  const assigned = app.assigned_cohort_id ? cohortById[app.assigned_cohort_id] : null;
  const next = applicantNextAction(status);
  const signedIds = new Map((signatures ?? []).map((s) => [s.template_id, s]));

  return (
    <div>
      <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> All applications
      </Link>

      {sp.submitted && (
        <Alert tone="success" title="Application submitted!" className="mt-4">
          We&apos;ve emailed a confirmation to {app.email}. You can follow your progress right here.
        </Alert>
      )}

      <Card className="mt-4 overflow-hidden p-0">
        <div className="relative overflow-hidden bg-ink p-6 text-white sm:p-8">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-maroon/60 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{program?.short_name}</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">
                {app.first_name} {app.last_name}
              </h1>
              <p className="mt-1 text-sm text-white/60">Applied {formatDate(app.submitted_at)} · ID {app.id.slice(0, 8)}</p>
            </div>
            <Badge tone={STATUS_TONE[status]} className="self-start text-sm">
              {STATUS_LABEL[status]}
            </Badge>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <StatusTracker status={status} />
        </div>
      </Card>

      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm" aria-label="Application sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            scroll={false}
            className={cn(
              "whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition",
              tab === t.key ? "bg-ink text-white" : "text-ink/60 hover:bg-mist hover:text-ink",
            )}
          >
            {t.label}
            {t.key === next.tab && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-gold align-middle" aria-label="action needed" />}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <Card>
              <h2 className="text-lg font-black">Status history</h2>
              <div className="mt-6">
                <Timeline events={(events ?? []) as TimelineEvent[]} />
              </div>
            </Card>
            <div className="grid content-start gap-6">
              <Card className={cn(next.tab && "border-gold bg-gold/10")}>
                <p className="text-xs font-bold uppercase tracking-widest text-maroon">Next step</p>
                <p className="mt-2 text-lg font-black">{next.title}</p>
                <p className="mt-1 text-sm text-ink/70">{next.body}</p>
                {next.tab && (
                  <ButtonLink href={`?tab=${next.tab}`} className="mt-4">
                    Continue
                  </ButtonLink>
                )}
              </Card>
              {assigned && (
                <Card>
                  <p className="text-xs font-bold uppercase tracking-widest text-maroon">Your cohort</p>
                  <p className="mt-2 text-lg font-black">{assigned.name}</p>
                  <div className="mt-3">
                    <CohortDetails c={assigned} />
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {tab === "exam" && (
          <Card>
            <h2 className="text-lg font-black">TestGorilla assessment</h2>
            {status === "exam_invited" ? (
              <div className="mt-4 space-y-5">
                <p className="text-ink/70">
                  Invitation sent {formatDateTime(app.exam_invited_at)}. Complete the assessment in one sitting in a quiet place. Results are
                  reviewed by TSMC Arizona and posted here by admissions.
                </p>
                {app.exam_url && (
                  <ButtonLink href={app.exam_url} target="_blank" rel="noopener noreferrer" size="lg">
                    Open my assessment <ExternalLink className="h-4 w-4" />
                  </ButtonLink>
                )}
                <MarkExamComplete applicationId={app.id} done={!!app.exam_self_reported_at} />
              </div>
            ) : app.exam_result ? (
              <Alert tone={app.exam_result === "passed" ? "success" : "danger"} title={app.exam_result === "passed" ? "Passed" : "Not passed"} className="mt-4">
                Result recorded {formatDateTime(app.exam_result_at)}.
              </Alert>
            ) : (
              <p className="mt-4 text-ink/60">Your assessment link will appear here after you pass initial screening.</p>
            )}
          </Card>
        )}

        {tab === "cohorts" && (
          <div>
            {status === "cohort_selection" ? (
              <CohortPicker applicationId={app.id} cohorts={cohorts} />
            ) : (enrollments ?? []).length > 0 || (prefs ?? []).length > 0 ? (
              <Card>
                <h2 className="text-lg font-black">Your cohort choices</h2>
                {status === "waitlisted" && (
                  <Alert tone="warn" className="mt-4" title="You're on the waitlist">
                    We&apos;ll register you automatically and email you if a seat opens in any of your choices.
                  </Alert>
                )}
                <ol className="mt-5 grid gap-4 md:grid-cols-3">
                  {(prefs ?? []).map((p) => {
                    const c = cohortById[p.cohort_id];
                    const e = (enrollments ?? []).find((x) => x.cohort_id === p.cohort_id);
                    if (!c) return null;
                    return (
                      <li key={p.cohort_id} className={cn("rounded-2xl border p-5", e?.status === "registered" ? "border-emerald-400 bg-emerald-50" : "border-ink/10")}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-maroon">Choice #{p.rank}</span>
                          {e && (
                            <Badge tone={e.status === "registered" ? "success" : e.status === "waitlisted" ? "warn" : "neutral"}>
                              {e.status === "waitlisted" ? `Waitlist #${e.waitlist_position}` : e.status}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 font-black">{c.name}</p>
                        <div className="mt-3">
                          <CohortDetails c={c} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            ) : (
              <Card>
                <p className="text-ink/60">Cohort selection opens after a successful assessment result.</p>
              </Card>
            )}
          </div>
        )}

        {tab === "agreements" && (
          <div className="grid gap-6">
            {status === "confirmed" && (
              <Alert tone="success" title="You're confirmed!">
                <span className="inline-flex items-center gap-2">
                  <PartyPopper className="h-4 w-4" /> Your documents were verified on {formatDate(app.confirmed_at)}.
                </span>
              </Alert>
            )}
            {!["agreements_pending", "agreements_submitted", "confirmed"].includes(status) && (
              <Card>
                <p className="text-ink/60">Program agreements become available once you&apos;re registered in a cohort.</p>
              </Card>
            )}
            {["agreements_pending", "agreements_submitted", "confirmed"].includes(status) &&
              (templates ?? []).map((t) => {
                const sig = signedIds.get(t.id);
                const signedCurrent = sig && sig.template_version === t.version;
                return (
                  <Card key={t.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-lg font-black">
                        <FileSignature className="h-5 w-5 text-maroon" /> {t.title}
                      </h2>
                      {signedCurrent ? <Badge tone="success">Signed {formatDate(sig.signed_at)}</Badge> : <Badge tone="progress">Signature needed</Badge>}
                    </div>
                    <div className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-mist p-4 text-sm leading-relaxed text-ink/80">{t.body}</div>
                    {signedCurrent ? (
                      <p className="mt-4 text-sm text-ink/60">
                        Signed as <strong>{sig.typed_name}</strong>.{" "}
                        {sig.pdf_path && (
                          <a href={`/api/files?path=${encodeURIComponent(sig.pdf_path)}`} className="inline-flex items-center gap-1 font-bold text-maroon hover:underline">
                            <Download className="h-4 w-4" /> Download signed PDF
                          </a>
                        )}
                      </p>
                    ) : status === "agreements_pending" ? (
                      <ActionForm action={signAgreement} className="mt-5 grid gap-4">
                        <input type="hidden" name="application_id" value={app.id} />
                        <input type="hidden" name="template_id" value={t.id} />
                        <label className="flex items-start gap-3 text-sm">
                          <input type="checkbox" name="agree" className="mt-0.5 h-5 w-5 accent-maroon" required />
                          I have read this document and agree to sign it electronically. My electronic signature is legally binding, just like a
                          handwritten one.
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`name-${t.id}`}>Type your full legal name</Label>
                            <Input id={`name-${t.id}`} name="typed_name" required defaultValue={`${app.first_name} ${app.last_name}`} />
                          </div>
                          <div>
                            <Label>Draw your signature</Label>
                            <SignaturePad />
                          </div>
                        </div>
                        <SubmitButton pendingText="Signing…" className="justify-self-start">
                          Sign document
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </Card>
                );
              })}
          </div>
        )}

        {tab === "messages" && (
          <Card>
            <h2 className="text-lg font-black">Messages with admissions</h2>
            <div className="mt-6">
              <MessageThread
                viewerId={session.userId}
                messages={((messages ?? []) as Message[]).map((m) => ({
                  ...m,
                  sender_name: m.sender_id === session.userId ? "You" : "Admissions",
                }))}
              />
            </div>
            <ActionForm action={sendApplicantMessage} resetOnSuccess className="mt-6 grid gap-3">
              <input type="hidden" name="application_id" value={app.id} />
              <Label htmlFor="body">New message</Label>
              <Textarea id="body" name="body" required maxLength={5000} placeholder="Ask a question or share an update…" />
              <SubmitButton className="justify-self-start" pendingText="Sending…">
                Send message
              </SubmitButton>
            </ActionForm>
          </Card>
        )}

        {tab === "details" && (
          <Card>
            <h2 className="text-lg font-black">Your application</h2>
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                ["Name", `${app.first_name} ${app.last_name}`],
                ["Email", app.email],
                ["Phone", app.phone],
                ["Highest diploma/degree", EDUCATION_LABEL[app.highest_education]],
                ["Major", app.major || "—"],
                ["Visa sponsorship", VISA_LABEL[app.visa_sponsorship]],
                ["18+ by completion", app.will_be_18_by_completion ? "Yes" : "No"],
                ["Share with employer partners", app.share_with_employers ? "Yes" : "No"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-bold uppercase tracking-wider text-ink/50">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {app.resume_path && (
              <a href={`/api/files?path=${encodeURIComponent(app.resume_path)}`} className="mt-6 inline-flex items-center gap-2 font-bold text-maroon hover:underline">
                <Download className="h-4 w-4" /> View my resume
              </a>
            )}
            {!isTerminal(status) && (
              <div className="mt-10 border-t border-ink/10 pt-6">
                <p className="text-sm font-bold">Withdraw application</p>
                <p className="text-sm text-ink/60">If you withdraw, any cohort seat you hold is released to the next person on the waitlist.</p>
                <ActionForm action={withdrawApplication} confirm="Withdraw your application? This can't be undone." className="mt-3">
                  <input type="hidden" name="application_id" value={app.id} />
                  <SubmitButton variant="outline" size="sm" pendingText="Withdrawing…">
                    Withdraw my application
                  </SubmitButton>
                </ActionForm>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
