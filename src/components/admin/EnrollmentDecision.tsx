import { adminAct } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge } from "@/components/ui";
import type { CohortAvailability } from "@/lib/data";
import type { Status } from "@/lib/workflow";
import { cn, formatDate } from "@/lib/utils";

type Pref = { cohort_id: string; rank: number };
type Enrollment = { cohort_id: string; status: string; waitlist_position: number | null };

/**
 * Admissions' placement step: the applicant's ranked choices with live seats. Accept them into the cohort they hold
 * (once agreements are signed), or move them to another cohort from their own list.
 */
export function EnrollmentDecision({
  appId,
  applicantName,
  status,
  prefs,
  enrollments,
  cohortById,
  signed,
}: {
  appId: string;
  applicantName: string;
  status: Status;
  prefs: Pref[];
  enrollments: Enrollment[];
  cohortById: Record<string, CohortAvailability>;
  signed: { done: number; total: number };
}) {
  const held = enrollments.find((e) => e.status === "registered");
  const choices = [
    ...prefs.map((p) => ({ cohortId: p.cohort_id, label: `Choice #${p.rank}` })),
    // A seat assigned outside the choice list (older records) still shows up.
    ...enrollments
      .filter((e) => e.status === "registered" && !prefs.some((p) => p.cohort_id === e.cohort_id))
      .map((e) => ({ cohortId: e.cohort_id, label: "Assigned by admissions" })),
  ];
  const heldCohort = held ? cohortById[held.cohort_id] : undefined;

  return (
    <div className="rounded-2xl border border-gold/70 bg-gold/5 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-maroon">Enrollment decision</p>
      <p className="mt-1 text-sm text-ink/60">Accept {applicantName.split(" ")[0]} into the cohort they hold, or move them to another of their choices.</p>

      <ol className="mt-3 space-y-2">
        {choices.map(({ cohortId, label }) => {
          const c = cohortById[cohortId];
          if (!c) return null;
          const e = enrollments.find((x) => x.cohort_id === cohortId);
          const isHeld = e?.status === "registered";
          const waitlisted = e?.status === "waitlisted";
          return (
            <li key={cohortId} className={cn("rounded-xl border bg-white p-3", isHeld ? "border-emerald-400 ring-1 ring-emerald-400" : "border-ink/10")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-maroon">{label}</p>
                  <p className="font-bold leading-snug">{c.name}</p>
                  <p className="text-xs text-ink/60">
                    {formatDate(c.start_date)} – {formatDate(c.end_date)} · {c.location}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {isHeld ? <Badge tone="success">Holding seat</Badge> : waitlisted ? <Badge tone="warn">Waitlist #{e?.waitlist_position}</Badge> : null}
                  <p className="mt-1 text-xs tabular-nums text-ink/50">
                    {c.seats_left} of {c.capacity} left
                  </p>
                </div>
              </div>
              {!isHeld &&
                (c.status !== "open" ? (
                  <p className="mt-2 text-xs font-bold text-ink/40">Cohort {c.status}</p>
                ) : c.seats_left > 0 ? (
                  <ActionForm
                    action={adminAct}
                    confirm={`Move ${applicantName} to ${c.name}?${held ? " Their current seat is released to the waitlist." : ""}`}
                    className="mt-2"
                  >
                    <input type="hidden" name="application_id" value={appId} />
                    <input type="hidden" name="op" value="assign_cohort" />
                    <input type="hidden" name="cohort_id" value={cohortId} />
                    <SubmitButton size="sm" variant="outline" className="w-full" pendingText="Moving…">
                      Move to this cohort
                    </SubmitButton>
                  </ActionForm>
                ) : (
                  <p className="mt-2 text-xs font-bold text-ink/40">Full</p>
                ))}
            </li>
          );
        })}
      </ol>

      <div className="mt-4">
        {held && heldCohort && status === "agreements_submitted" ? (
          <ActionForm
            action={adminAct}
            confirm={`Accept ${applicantName} into ${heldCohort.name} and confirm enrollment? They'll get their confirmation email and calendar invite.`}
          >
            <input type="hidden" name="application_id" value={appId} />
            <input type="hidden" name="op" value="confirm" />
            <SubmitButton size="sm" className="w-full" pendingText="Confirming…">
              Accept into {heldCohort.name} & confirm
            </SubmitButton>
          </ActionForm>
        ) : held ? (
          <p className="rounded-xl bg-white p-3 text-sm text-ink/70">
            Agreements: <strong>{signed.done} of {signed.total}</strong> signed. You can accept once they&apos;re all signed.
          </p>
        ) : (
          <p className="rounded-xl bg-white p-3 text-sm text-ink/70">
            All of the applicant&apos;s choices are full. They move up automatically when a seat opens, or move them into a choice once one has
            space.
          </p>
        )}
      </div>

      <ActionForm
        action={adminAct}
        confirm="Release this applicant's seat and reopen cohort selection? The next person on the waitlist is promoted."
        className="mt-2"
      >
        <input type="hidden" name="application_id" value={appId} />
        <input type="hidden" name="op" value="release_seat" />
        <SubmitButton size="sm" variant="ghost" className="w-full text-ink/60" pendingText="Releasing…">
          Release seat & let them choose again
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
