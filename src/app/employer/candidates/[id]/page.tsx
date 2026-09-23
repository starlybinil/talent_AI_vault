import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { addEmployerNote, toggleShortlist } from "@/app/employer/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { FIELD_LABEL, candidateName, displayField, isOutcomeKey, outcomeOf, type Candidate } from "@/lib/employer";
import { OutcomeCard } from "@/components/portal/OutcomeCard";
import { audit } from "@/lib/audit";
import { formatDateTime } from "@/lib/utils";

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("employer.portal", `/employer/candidates/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("employer_list_candidates");
  const c = ((data ?? []) as Candidate[]).find((x) => x.application_id === id);
  if (!c) notFound();
  const outcome = outcomeOf(c);
  const { data: notes } = await supabase.from("employer_notes").select("id, kind, body, created_at").eq("application_id", id).order("created_at", { ascending: false });

  // Employers can't read applications; this RPC returns the path only if the program policy shares resumes.
  const { data: resumePath } = c.fields.resume ? await supabase.rpc("employer_resume_path", { p_app: id }) : { data: null };
  const resumeHref = resumePath ? `/api/files?path=${encodeURIComponent(resumePath as string)}` : null;
  await audit(supabase, "employer.candidate.view", "application", id);

  return (
    <div>
      <Link href="/employer/candidates" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> All candidates
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow={c.program_name}
          title={candidateName(c)}
          actions={
            <ActionForm action={toggleShortlist}>
              <input type="hidden" name="application_id" value={id} />
              <SubmitButton variant={c.shortlisted ? "gold" : "outline"}>
                <Star className={`h-4 w-4 ${c.shortlisted ? "fill-ink" : ""}`} /> {c.shortlisted ? "Shortlisted" : "Add to shortlist"}
              </SubmitButton>
            </ActionForm>
          }
        />
      </div>
      {outcome && (
        <div className="mb-6">
          <OutcomeCard audience="employer" outcome={outcome} name={candidateName(c)} />
          {c.fields.hired_by_you === true && <p className="mt-2 text-sm font-bold text-success">Hired by your organization.</p>}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <h2 className="font-black">Shared details</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {Object.entries(c.fields)
              .filter(([k]) => !isOutcomeKey(k))
              .map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-bold uppercase tracking-wider text-ink/50">{FIELD_LABEL[k] ?? k}</dt>
                <dd className="mt-1 font-medium">{displayField(k, v)}</dd>
              </div>
            ))}
          </dl>
          {resumeHref && (
            <a href={resumeHref} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-maroon">
              <FileText className="h-4 w-4" /> Open resume
            </a>
          )}
        </Card>
        <Card>
          <h2 className="font-black">Feedback to admissions</h2>
          <ActionForm action={addEmployerNote} resetOnSuccess className="mt-4 grid gap-3">
            <input type="hidden" name="application_id" value={id} />
            <div>
              <Label>Type</Label>
              <Select name="kind">
                <option value="note">General note</option>
                <option value="interview_interest">Interview interest</option>
                <option value="exam_result_proposal">Assessment result (for admissions to record)</option>
              </Select>
            </div>
            <Textarea name="body" required placeholder="e.g. Strong fit for equipment tech II; schedule interview after week 3." aria-label="Note" />
            <SubmitButton variant="dark" className="justify-self-start">Share</SubmitButton>
          </ActionForm>
          <ul className="mt-6 space-y-3">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="rounded-xl bg-mist p-3 text-sm">
                <p className="text-xs font-bold text-ink/50">
                  {n.kind.replace(/_/g, " ")} · {formatDateTime(n.created_at)}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
