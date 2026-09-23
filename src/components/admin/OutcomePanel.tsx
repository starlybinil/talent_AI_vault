import { Briefcase, GraduationCap } from "lucide-react";
import { recordCompletion, recordHire, undoOutcome } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, Input, Label, Select, Textarea } from "@/components/ui";
import type { Status } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";

export type Outcome = {
  completed_on: string | null;
  completion_note: string | null;
  hired_employer_org_id: string | null;
  hired_employer_name: string | null;
  hired_job_title: string | null;
  hired_start_date: string | null;
};

/** Program completion + hire for confirmed trainees. Program admins record them; everyone with access sees them. */
export function OutcomePanel({
  appId,
  status,
  outcome,
  canManage,
  employers,
  defaultCompletionDate,
}: {
  appId: string;
  status: Status;
  outcome: Outcome;
  canManage: boolean;
  employers: Array<{ id: string; name: string }>;
  defaultCompletionDate: string;
}) {
  const completed = status === "completed" || status === "hired";
  const hired = status === "hired";

  return (
    <Card className="overflow-hidden border-success/30 p-0">
      <div className="bg-gradient-to-br from-ink to-ink-800 px-6 py-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Program outcomes</p>
        <p className="mt-1 text-sm text-white/70">Recorded by admissions. The trainee and partner employers see these in their portals.</p>
      </div>

      {/* Completion */}
      <section className="border-b border-ink/10 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-black">
            <GraduationCap className="h-5 w-5 text-maroon" aria-hidden /> Program completion
          </h2>
          <Badge tone={completed ? "success" : "neutral"}>{completed ? "Completed" : "Not yet"}</Badge>
        </div>
        {completed && (
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink/50">Completed on</dt>
              <dd className="font-bold">{outcome.completed_on ? formatDate(outcome.completed_on) : "—"}</dd>
            </div>
            {outcome.completion_note && (
              <div>
                <dt className="text-ink/50">Credentials / notes</dt>
                <dd className="mt-0.5 font-medium">{outcome.completion_note}</dd>
              </div>
            )}
          </dl>
        )}
        {canManage && (
          <Collapsible summary={completed ? "Edit completion details" : null}>
            <ActionForm
              action={recordCompletion}
              className="mt-3 grid gap-3"
              confirm={
                completed
                  ? undefined
                  : {
                      title: "Record successful program completion?",
                      body: "The trainee is emailed a congratulations, and partner employers see that they completed the program.",
                      confirmLabel: "Record completion",
                      cancelLabel: "Cancel",
                      tone: "default",
                    }
              }
            >
              <input type="hidden" name="application_id" value={appId} />
              <div>
                <Label htmlFor="completed_on">Completion date</Label>
                <Input id="completed_on" name="completed_on" type="date" required defaultValue={outcome.completed_on ?? defaultCompletionDate} />
              </div>
              <div>
                <Label htmlFor="completion_note">Credentials earned / notes (shared)</Label>
                <Textarea
                  id="completion_note"
                  name="completion_note"
                  maxLength={500}
                  defaultValue={outcome.completion_note ?? ""}
                  placeholder="e.g. Industry-recognized credentials earned; 100% attendance"
                  className="min-h-16 text-sm"
                />
              </div>
              <SubmitButton variant={completed ? "dark" : "gold"} size="sm" pendingText="Saving…">
                {completed ? "Save completion details" : "Record successful completion"}
              </SubmitButton>
            </ActionForm>
          </Collapsible>
        )}
      </section>

      {/* Hire */}
      <section className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-black">
            <Briefcase className="h-5 w-5 text-maroon" aria-hidden /> Hired by an employer
          </h2>
          <Badge tone={hired ? "success" : "neutral"}>{hired ? "Hired" : completed ? "Not yet" : "After completion"}</Badge>
        </div>
        {hired && (
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink/50">Employer</dt>
              <dd className="text-right font-bold">{outcome.hired_employer_name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/50">Job title</dt>
              <dd className="text-right font-bold">{outcome.hired_job_title || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink/50">Start date</dt>
              <dd className="font-bold">{outcome.hired_start_date ? formatDate(outcome.hired_start_date) : "—"}</dd>
            </div>
          </dl>
        )}
        {!completed && <p className="mt-3 text-sm text-ink/50">Record program completion first.</p>}
        {canManage && completed && (
          <Collapsible summary={hired ? "Edit hire details" : null}>
            <ActionForm
              action={recordHire}
              className="mt-3 grid gap-3"
              confirm={
                hired
                  ? undefined
                  : {
                      title: "Record this hire?",
                      body: "The graduate is emailed a congratulations, and partner employers see who hired them.",
                      confirmLabel: "Record hire",
                      cancelLabel: "Cancel",
                      tone: "default",
                    }
              }
            >
              <input type="hidden" name="application_id" value={appId} />
              <div>
                <Label htmlFor="employer_org_id">Employer</Label>
                <Select id="employer_org_id" name="employer_org_id" defaultValue={outcome.hired_employer_org_id ?? employers[0]?.id ?? ""}>
                  {employers.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                  <option value="">Another employer (type below)</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="employer_name">Other employer name</Label>
                <Input
                  id="employer_name"
                  name="employer_name"
                  maxLength={120}
                  defaultValue={outcome.hired_employer_org_id ? "" : (outcome.hired_employer_name ?? "")}
                  placeholder="Only if not in the list above"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="job_title">Job title</Label>
                  <Input id="job_title" name="job_title" maxLength={120} defaultValue={outcome.hired_job_title ?? ""} placeholder="Equipment Technician I" />
                </div>
                <div>
                  <Label htmlFor="start_date">Start date</Label>
                  <Input id="start_date" name="start_date" type="date" defaultValue={outcome.hired_start_date ?? ""} />
                </div>
              </div>
              {!hired && <Textarea name="note" maxLength={500} placeholder="Optional note for the timeline" className="min-h-14 text-sm" aria-label="Note" />}
              <SubmitButton variant={hired ? "dark" : "gold"} size="sm" pendingText="Saving…">
                {hired ? "Save hire details" : "Record hire"}
              </SubmitButton>
            </ActionForm>
          </Collapsible>
        )}
      </section>

      {canManage && completed && (
        <ActionForm
          action={undoOutcome}
          className="border-t border-ink/10 bg-mist/60 px-6 py-4"
          confirm={{
            title: hired ? "Remove the hire record?" : "Remove the completion record?",
            body: hired
              ? "The status goes back to Program completed and the hire details are cleared. Nobody is emailed."
              : "The status goes back to Confirmed and the completion details are cleared. Nobody is emailed.",
            confirmLabel: hired ? "Remove hire" : "Remove completion",
            cancelLabel: "Keep it",
          }}
        >
          <input type="hidden" name="application_id" value={appId} />
          <SubmitButton variant="ghost" size="sm" pendingText="Undoing…" className="text-ink/60">
            {hired ? "Undo hire (recorded by mistake)" : "Undo completion (recorded by mistake)"}
          </SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}

/** Collapsed behind a summary once recorded; shown open (without a toggle) when there's nothing recorded yet. */
function Collapsible({ summary, children }: { summary: string | null; children: React.ReactNode }) {
  if (!summary) return <div className="mt-4">{children}</div>;
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-bold text-maroon">{summary}</summary>
      {children}
    </details>
  );
}
