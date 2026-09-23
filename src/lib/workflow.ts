/**
 * Admissions workflow: statuses, allowed transitions, applicant-facing stages and email mapping.
 * The allowed-transition list mirrors public.transition_allowed() in supabase/migrations — keep them in sync.
 */

export const STATUSES = [
  "submitted",
  "screening",
  "screening_passed",
  "not_selected",
  "exam_invited",
  "exam_passed",
  "exam_failed",
  "cohort_selection",
  "cohort_registered",
  "waitlisted",
  "agreements_pending",
  "agreements_submitted",
  "confirmed",
  "completed",
  "hired",
  "withdrawn",
] as const;

export type Status = (typeof STATUSES)[number];

export const TRANSITIONS: ReadonlyArray<readonly [Status, Status]> = [
  ["submitted", "screening"],
  ["submitted", "not_selected"],
  ["screening", "screening_passed"],
  ["screening", "not_selected"],
  ["not_selected", "screening"],
  ["screening_passed", "exam_invited"],
  ["exam_invited", "exam_passed"],
  ["exam_invited", "exam_failed"],
  ["exam_failed", "exam_invited"],
  ["exam_passed", "cohort_selection"],
  ["cohort_selection", "cohort_registered"],
  ["cohort_selection", "waitlisted"],
  ["waitlisted", "cohort_registered"],
  ["waitlisted", "cohort_selection"],
  ["cohort_registered", "agreements_pending"],
  ["cohort_registered", "cohort_selection"],
  ["agreements_pending", "cohort_selection"],
  ["agreements_pending", "agreements_submitted"],
  ["agreements_submitted", "agreements_pending"],
  ["agreements_submitted", "confirmed"],
  ["agreements_submitted", "cohort_selection"],
  ["confirmed", "cohort_selection"],
  // Outcomes, recorded by program admins (undo steps back one stage).
  ["confirmed", "completed"],
  ["completed", "hired"],
  ["completed", "confirmed"],
  ["hired", "completed"],
];

export function canTransition(from: Status, to: Status): boolean {
  if (to === "withdrawn") return canWithdraw(from);
  return TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export function nextStatuses(from: Status): Status[] {
  const next = TRANSITIONS.filter(([f]) => f === from).map(([, t]) => t);
  if (canTransition(from, "withdrawn")) next.push("withdrawn");
  return next;
}

export const STATUS_LABEL: Record<Status, string> = {
  submitted: "Submitted",
  screening: "In screening",
  screening_passed: "Screening passed",
  not_selected: "Not selected",
  exam_invited: "Assessment invited",
  exam_passed: "Assessment passed",
  exam_failed: "Assessment not passed",
  cohort_selection: "Enrollment open",
  cohort_registered: "Cohort registered",
  waitlisted: "Waitlisted",
  agreements_pending: "Agreements to sign",
  agreements_submitted: "Awaiting final confirmation",
  confirmed: "Confirmed",
  completed: "Program completed",
  hired: "Hired",
  withdrawn: "Withdrawn",
};

export type Tone = "neutral" | "info" | "progress" | "success" | "danger" | "warn";

export const STATUS_TONE: Record<Status, Tone> = {
  submitted: "info",
  screening: "info",
  screening_passed: "progress",
  not_selected: "danger",
  exam_invited: "progress",
  exam_passed: "success",
  exam_failed: "danger",
  cohort_selection: "progress",
  cohort_registered: "success",
  waitlisted: "warn",
  agreements_pending: "progress",
  agreements_submitted: "info",
  confirmed: "success",
  completed: "success",
  hired: "success",
  withdrawn: "neutral",
};

/** The milestones the applicant sees in their progress tracker. */
export const STAGES = [
  { key: "apply", label: "Apply", description: "Submit your application" },
  { key: "screening", label: "Screening", description: "Admissions reviews your application" },
  { key: "assessment", label: "Assessment", description: "Complete the TestGorilla assessment" },
  { key: "enroll", label: "Enrollment", description: "Choose your cohorts and sign your agreements" },
  { key: "confirmed", label: "Confirmed", description: "You're in — see you in the lab" },
  { key: "completed", label: "Completed", description: "Successfully complete the program" },
  { key: "hired", label: "Hired", description: "Interview with employer partners and start your career" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

const STAGE_OF: Record<Status, StageKey> = {
  submitted: "screening",
  screening: "screening",
  screening_passed: "assessment",
  not_selected: "screening",
  exam_invited: "assessment",
  exam_passed: "enroll",
  exam_failed: "assessment",
  cohort_selection: "enroll",
  cohort_registered: "enroll",
  waitlisted: "enroll",
  agreements_pending: "enroll",
  agreements_submitted: "confirmed",
  confirmed: "completed",
  completed: "hired",
  hired: "hired",
  withdrawn: "apply",
};

export function stageIndex(status: Status): number {
  return STAGES.findIndex((s) => s.key === STAGE_OF[status]);
}

/** Stage state for the tracker: which steps are complete, current, blocked. */
export function stageStates(status: Status): Array<"done" | "current" | "blocked" | "upcoming"> {
  const current = stageIndex(status);
  const blocked = status === "not_selected" || status === "exam_failed" || status === "withdrawn";
  return STAGES.map((_, i) => {
    if (status === "hired") return "done";
    if (i < current) return "done";
    if (i === current) return blocked ? "blocked" : "current";
    return "upcoming";
  });
}

/** Statuses reached after the trainee finishes the program. */
export const OUTCOME_STATUSES: readonly Status[] = ["completed", "hired"];

/** Applicants (and admissions) can withdraw at any stage — even after confirmation — until they finish the program. */
export function canWithdraw(status: Status): boolean {
  return status !== "withdrawn" && !OUTCOME_STATUSES.includes(status);
}

/** Confirmed trainees and beyond: they hold (or held) a seat in a running or finished cohort. */
export function isTrainee(status: Status): boolean {
  return status === "confirmed" || OUTCOME_STATUSES.includes(status);
}

/** Statuses where the applicant holds a seat or waitlist spot and may leave it to pick another cohort. */
export const COHORT_HOLD_STATUSES: readonly Status[] = [
  "cohort_registered",
  "waitlisted",
  "agreements_pending",
  "agreements_submitted",
  "confirmed",
];

export function canChangeCohort(status: Status): boolean {
  return COHORT_HOLD_STATUSES.includes(status);
}

export function isTerminal(status: Status): boolean {
  return status === "hired" || status === "withdrawn" || status === "not_selected" || status === "exam_failed";
}

/** What the applicant should do next, if anything. */
export function applicantNextAction(status: Status): { title: string; body: string; tab?: string } {
  switch (status) {
    case "submitted":
    case "screening":
      return {
        title: "We're reviewing your application",
        body: "Admissions is reviewing your application. You'll get an email as soon as there's an update — usually within a few business days.",
      };
    case "screening_passed":
      return {
        title: "You passed initial screening",
        body: "Your assessment invitation is being prepared. Watch your inbox for the TestGorilla link.",
      };
    case "exam_invited":
      return {
        title: "Complete your assessment",
        body: "Open your TestGorilla assessment and complete it. When you're done, let us know so we can follow up with TSMC Arizona.",
        tab: "exam",
      };
    case "exam_passed":
    case "cohort_selection":
      return {
        title: "Enroll: choose your cohorts and sign",
        body: "Congratulations on passing the assessment! Rank up to three cohorts, then sign your program agreements on the same page.",
        tab: "enrollment",
      };
    case "waitlisted":
      return {
        title: "You're on the waitlist",
        body: "Your chosen cohorts are full right now. Sign your program agreements now so you're ready: we'll move you up automatically and email you the moment a seat opens.",
        tab: "enrollment",
      };
    case "cohort_registered":
    case "agreements_pending":
      return {
        title: "Sign your program agreements",
        body: "Your seat is reserved. Review and e-sign each program agreement to lock it in.",
        tab: "enrollment",
      };
    case "agreements_submitted":
      return {
        title: "Awaiting final confirmation",
        body: "You're enrolled and your agreements are signed. Admissions will review everything and send your final confirmation by email.",
      };
    case "confirmed":
      return {
        title: "You're confirmed!",
        body: "Welcome to the program. Your cohort details and calendar invite are in your inbox. Admissions records your completion when you finish.",
      };
    case "completed":
      return {
        title: "You completed the program!",
        body: "Congratulations, graduate. Partner employers can now see that you finished. Admissions will record your hire when you accept a job offer.",
      };
    case "hired":
      return {
        title: "You're hired!",
        body: "Congratulations on starting your career. Thank you for being part of the program.",
      };
    case "exam_failed":
      return {
        title: "Assessment result",
        body: "Unfortunately the assessment result did not meet the program threshold this time. Admissions may reach out about future opportunities.",
      };
    case "not_selected":
      return {
        title: "Application decision",
        body: "Thank you for your interest. We aren't able to move your application forward at this time.",
      };
    case "withdrawn":
      return { title: "Application withdrawn", body: "This application has been withdrawn." };
  }
}

/** Email template sent when an application enters a status (null = no email). */
export type EmailTemplate =
  | "application_received"
  | "screening_passed"
  | "exam_invite"
  | "exam_reminder"
  | "exam_passed"
  | "exam_failed"
  | "not_selected"
  | "cohort_registered"
  | "waitlisted"
  | "waitlist_promoted"
  | "agreements_submitted"
  | "confirmed"
  | "program_completed"
  | "hired"
  | "new_message"
  | "status_update";

export const EMAIL_FOR_STATUS: Partial<Record<Status, EmailTemplate>> = {
  submitted: "application_received",
  screening_passed: "screening_passed",
  exam_invited: "exam_invite",
  cohort_selection: "exam_passed",
  exam_failed: "exam_failed",
  not_selected: "not_selected",
  agreements_pending: "cohort_registered",
  waitlisted: "waitlisted",
  agreements_submitted: "agreements_submitted",
  confirmed: "confirmed",
  completed: "program_completed",
  hired: "hired",
};

export const EDUCATION_LABEL: Record<string, string> = {
  hs_ged: "High school diploma / GED",
  some_college: "Some college (no degree)",
  certificate: "Technical certificate",
  associate: "Associate degree",
  bachelor: "Bachelor's degree",
  master_plus: "Master's degree or higher",
};

export const DEGREE_LEVELS = ["associate", "bachelor", "master_plus"] as const;

export const VISA_LABEL: Record<string, string> = {
  now: "Yes — now",
  future: "Yes — in the future",
  no: "No",
};
