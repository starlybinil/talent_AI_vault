import {
  BookOpen,
  ExternalLink,
  FileText,
  Flag,
  MapPin,
  Sparkles,
} from "lucide-react";
import { leaveProgram } from "@/app/portal/actions";
import { CohortDetails } from "@/components/program/CohortCard";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, Label, Textarea } from "@/components/ui";
import type { CohortAvailability } from "@/lib/data";
import { LEAVE_REASONS, type Status } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";
import { encouragement, programProgress, todayInArizona } from "@/lib/schedule";

export type ProgramResource = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  file_name: string | null;
  href: string | null;
  cohort_id: string | null;
  created_at: string;
};

/** The trainee's "In program" page: their cohort, program resources, and the option to leave. */
export function InProgram({
  appId,
  status,
  programName,
  cohort,
  resources,
}: {
  appId: string;
  status: Status;
  programName: string;
  cohort: CohortAvailability | null;
  resources: ProgramResource[];
}) {
  const cohortLabel = cohort?.name ?? "your cohort";
  const progress = cohort
    ? programProgress(cohort.start_date, cohort.end_date, todayInArizona())
    : null;
  const mapHref = cohort?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cohort.address)}`
    : null;
  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-maroon to-maroon-900 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            Your cohort
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {cohort?.name ?? "Your cohort"}
          </h2>
          <p className="mt-1 text-sm text-white/70">{programName}</p>
        </div>
        {cohort ? (
          <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
            <CohortDetails c={cohort} />
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 self-start rounded-full border border-ink/15 px-4 py-2 text-sm font-bold text-ink hover:border-maroon hover:text-maroon"
              >
                <MapPin className="h-4 w-4" aria-hidden /> Directions to{" "}
                {cohort.location}
              </a>
            )}
          </div>
        ) : (
          <p className="p-6 text-sm text-ink/60">
            Your cohort details will appear here once admissions confirms your
            placement.
          </p>
        )}
      </Card>

      {progress && status === "confirmed" && (
        <Card className="overflow-hidden border-gold/60 bg-gradient-to-br from-gold/15 via-white to-white">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0"
              aria-hidden
            >
              <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#ececf0"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#8C1D40"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(progress.phase === "running" ? progress.pct : progress.phase === "finished" ? 100 : 0) * 0.974} 100`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {progress.phase === "upcoming" ? (
                  <>
                    <span className="text-2xl font-black tabular-nums text-ink">
                      {progress.daysUntil}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">
                      days to go
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black tabular-nums text-ink">
                      {progress.phase === "running" ? progress.pct : 100}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">
                      complete
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-maroon sm:justify-start">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {progress.phase === "upcoming"
                  ? `Starts ${formatDate(cohort!.start_date)}`
                  : progress.phase === "running"
                    ? `Week ${progress.week} of ${progress.weeks}`
                    : "Program complete"}
              </p>
              <p className="mt-2 text-lg font-black leading-snug text-ink">
                {encouragement(progress)}
              </p>
              {progress.phase === "running" && (
                <p className="mt-1 text-sm text-ink/60">
                  {progress.daysLeft === 0
                    ? "Today is your last day."
                    : `${progress.daysLeft} day${progress.daysLeft === 1 ? "" : "s"} to go until you finish on ${formatDate(cohort!.end_date)}.`}
                </p>
              )}
              {progress.phase === "upcoming" && (
                <p className="mt-1 text-sm text-ink/60">
                  {progress.weeks} weeks of hands-on training ahead of you.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <BookOpen className="h-5 w-5 text-maroon" aria-hidden /> Program
          resources
        </h2>
        {resources.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">
            Your program team will post schedules, guides and other materials
            here. Check back soon.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink/5">
            {resources.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold">
                    {r.url ? (
                      <ExternalLink
                        className="h-4 w-4 shrink-0 text-maroon"
                        aria-hidden
                      />
                    ) : (
                      <FileText
                        className="h-4 w-4 shrink-0 text-maroon"
                        aria-hidden
                      />
                    )}
                    {r.title}
                    {r.cohort_id && (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-ink/70">
                        Your cohort
                      </span>
                    )}
                  </p>
                  {r.description && (
                    <p className="mt-1 text-sm text-ink/60">{r.description}</p>
                  )}
                  <p className="mt-1 text-xs text-ink/40">
                    Added {formatDate(r.created_at)}
                  </p>
                </div>
                {r.href && (
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-full bg-ink px-4 py-2 text-center text-sm font-bold text-white hover:bg-maroon"
                  >
                    {r.url ? "Open link" : "Download"}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {status === "confirmed" && (
        <details id="leave" className="group scroll-mt-24 px-1">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-bold text-ink/40 hover:text-ink/70">
            <Flag className="h-3.5 w-3.5" aria-hidden /> Having trouble
            continuing?
          </summary>
          <Card className="mt-3">
            <h2 className="text-base font-black">Before you decide</h2>
            <p className="mt-1 text-sm text-ink/60">
              Most challenges can be worked out. Send the program team a message
              on the <strong>Messages</strong> tab: they can help with
              schedules, transportation, or switching to a different cohort. If
              you still need to step away, you can leave the program below. Your
              seat goes to the next person on the waitlist, so please tell us
              why.
            </p>
            <ActionForm
              action={leaveProgram}
              confirm={{
                title: "Are you sure you want to leave?",
                body: "This is your final confirmation.",
                points: [
                  `Your seat in ${cohortLabel} goes to the next person on the waitlist right away.`,
                  "Your application is marked withdrawn.",
                  "You can apply again later for a future cohort or another program.",
                ],
                confirmLabel: "Yes, leave the program",
                tone: "danger",
              }}
              className="mt-5 grid gap-4"
            >
              <input type="hidden" name="application_id" value={appId} />
              <fieldset>
                <legend className="text-sm font-bold">
                  Why are you leaving? (choose all that apply)
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {LEAVE_REASONS.map((r) => (
                    <label
                      key={r}
                      className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink/10 p-3 text-sm hover:border-maroon/40"
                    >
                      <input
                        type="checkbox"
                        name="reasons"
                        value={r}
                        className="mt-0.5 h-4 w-4 accent-maroon"
                      />{" "}
                      {r}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <Label htmlFor="leave-detail">
                  Anything else you&apos;d like us to know? (required if you
                  chose Other)
                </Label>
                <Textarea
                  id="leave-detail"
                  name="detail"
                  maxLength={1000}
                  placeholder="Optional details"
                />
              </div>
              <label className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-900">
                <input
                  type="checkbox"
                  name="acknowledge"
                  value="yes"
                  required
                  className="mt-0.5 h-4 w-4 accent-maroon"
                />
                I understand that leaving withdraws my application, gives up my
                seat in {cohortLabel}, and can&apos;t be undone online.
              </label>
              <SubmitButton
                variant="outline"
                size="sm"
                className="justify-self-start"
                pendingText="Leaving…"
              >
                Leave the program
              </SubmitButton>
            </ActionForm>
          </Card>
        </details>
      )}
    </div>
  );
}
