import { EDUCATION_LABEL, STATUS_LABEL, VISA_LABEL, type Status } from "@/lib/workflow";
import { EMPLOYER_FIELD_OPTIONS } from "@/lib/validation";
import { formatDate } from "@/lib/utils";
import type { OutcomeView } from "@/components/portal/OutcomeCard";

export type Candidate = {
  application_id: string;
  program_id: string;
  program_name: string;
  fields: Record<string, unknown>;
  shortlisted: boolean;
  updated_at: string;
};

/** Program outcome fields: always shared with partner employers for consenting candidates. */
export const OUTCOME_KEYS = ["completed_on", "completion_note", "hired_employer", "hired_job_title", "hired_start_date", "hired_by_you"] as const;

export const FIELD_LABEL: Record<string, string> = {
  ...Object.fromEntries(EMPLOYER_FIELD_OPTIONS.map((f) => [f.key, f.label])),
  completed_on: "Completed program",
  completion_note: "Credentials / completion notes",
  hired_employer: "Hired by",
  hired_job_title: "Job title",
  hired_start_date: "Start date",
  hired_by_you: "Hired by your organization",
};

export function isOutcomeKey(key: string): boolean {
  return (OUTCOME_KEYS as readonly string[]).includes(key);
}

export function outcomeOf(c: Candidate): OutcomeView | null {
  const f = c.fields;
  if (!f.completed_on && !f.hired_employer) return null;
  const s = (v: unknown) => (v == null ? null : String(v));
  return {
    completedOn: s(f.completed_on),
    completionNote: s(f.completion_note),
    employer: s(f.hired_employer),
    jobTitle: s(f.hired_job_title),
    startDate: s(f.hired_start_date),
  };
}

/** Stage filter for the candidate list and CSV export. Outcome stages don't depend on the status field being shared. */
export function matchesStage(c: Candidate, stage: string | null | undefined): boolean {
  switch (stage) {
    case "passed":
      return c.fields.exam_result === "passed";
    case "confirmed":
      return c.fields.status === "confirmed";
    case "completed":
      return !!c.fields.completed_on && !c.fields.hired_employer;
    case "hired":
      return !!c.fields.hired_employer;
    default:
      return true;
  }
}

/** Human-readable value for a policy-limited candidate field. */
export function displayField(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (key) {
    case "highest_education":
      return EDUCATION_LABEL[String(value)] ?? String(value);
    case "visa_sponsorship":
      return VISA_LABEL[String(value)] ?? String(value);
    case "status":
      return STATUS_LABEL[value as Status] ?? String(value);
    case "will_be_18_by_completion":
    case "resume":
      return value ? "Yes" : "No";
    case "submitted_at":
    case "completed_on":
    case "hired_start_date":
      return formatDate(String(value));
    case "hired_by_you":
      return value ? "Yes" : "No";
    case "exam_result":
      return value === "passed" ? "Passed" : value === "failed" ? "Not passed" : String(value);
    default:
      return String(value);
  }
}

export function candidateName(c: Candidate): string {
  const f = c.fields;
  const name = [f.first_name, f.last_name].filter(Boolean).join(" ");
  return name || `Candidate ${c.application_id.slice(0, 6).toUpperCase()}`;
}
