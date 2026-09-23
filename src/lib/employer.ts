import { EDUCATION_LABEL, STATUS_LABEL, VISA_LABEL, type Status } from "@/lib/workflow";
import { EMPLOYER_FIELD_OPTIONS } from "@/lib/validation";
import { formatDate } from "@/lib/utils";

export type Candidate = {
  application_id: string;
  program_id: string;
  program_name: string;
  fields: Record<string, unknown>;
  shortlisted: boolean;
  updated_at: string;
};

export const FIELD_LABEL: Record<string, string> = Object.fromEntries(EMPLOYER_FIELD_OPTIONS.map((f) => [f.key, f.label]));

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
      return formatDate(String(value));
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
