import { z } from "zod";
import { CLEANROOM_OPTIONS, ROLE_FIT, WORK_EXPERIENCE } from "@/lib/application-questions";

export const EDUCATION_LEVELS = ["no_hs", "hs_ged", "some_college", "certificate", "associate", "bachelor", "master_plus"] as const;
export const VISA_OPTIONS = ["now", "future", "no"] as const;

export const RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;

const phoneRegex = /^[+()\-.\s\d]{10,20}$/;

export const applicationSchema = z
  .object({
    program_slug: z.string().min(1),
    first_name: z.string().trim().min(1, "First name is required").max(80),
    last_name: z.string().trim().min(1, "Last name is required").max(80),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "Enter a valid phone number")
      .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a valid phone number"),
    highest_education: z.enum(EDUCATION_LEVELS, { message: "Select the highest level of education you have completed" }),
    major: z.string().trim().max(120).optional().default(""),
    will_be_18_by_completion: z.enum(["yes", "no"], { message: "Please answer the age question" }),
    work_authorized: z.enum(["yes", "no"], { message: "Tell us whether you're authorized to work in the U.S." }),
    visa_sponsorship: z.enum(VISA_OPTIONS, { message: "Tell us whether you'll need visa sponsorship" }),
    work_experience: z.enum(WORK_EXPERIENCE, { message: "Select your years of work experience" }),
    stem_degree_completed: z.enum(["yes", "no"], { message: "Please answer this question" }),
    stem_degree_enrolled: z.enum(["yes", "no"], { message: "Please answer this question" }),
    role_interest: z.enum(["yes", "no"]).optional(),
    cleanroom_willing: z.enum(CLEANROOM_OPTIONS).optional(),
    shift_willing: z.enum(["yes", "no"]).optional(),
    pay_range_accepted: z.enum(["yes", "no"]).optional(),
    share_with_employers: z.boolean().default(false),
    acknowledged: z.literal(true, { message: "Please check the box to certify and acknowledge the statements" }),
    resume_path: z.string().min(1, "Please upload your resume"),
  })
  .superRefine((v, ctx) => {
    // Role & pay questions apply only to programs that define them (answers are informational, not filtered).
    if (!ROLE_FIT[v.program_slug]) return;
    for (const k of ["role_interest", "cleanroom_willing", "shift_willing", "pay_range_accepted"] as const) {
      if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: "Please answer this question" });
    }
  });

export type ApplicationInput = z.infer<typeof applicationSchema>;

export function validateResume(file: { size: number; type: string; name: string }): string | null {
  if (!file || file.size === 0) return "Please upload your resume";
  if (file.size > RESUME_MAX_BYTES) return "Resume must be 5 MB or smaller";
  const okType = (RESUME_TYPES as readonly string[]).includes(file.type) || /\.(pdf|docx?|DOCX?|PDF)$/.test(file.name);
  if (!okType) return "Upload a PDF or Word document";
  return null;
}

export const emailSchema = z.string().trim().email("Enter a valid email address");
export const passwordSchema = z.string().min(8, "Use at least 8 characters");

export const cohortSchema = z.object({
  program_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  format: z.string().trim().min(2).max(60),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  schedule: z.string().trim().min(2).max(120),
  location_id: z.string().uuid("Choose a training location"),
  capacity: z.coerce.number().int().min(0).max(1000),
  status: z.enum(["open", "closed", "archived"]).default("open"),
});

export const locationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(200),
  notes: z.string().trim().max(500).optional().default(""),
});

export const EMPLOYER_FIELD_OPTIONS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "highest_education", label: "Education" },
  { key: "major", label: "Major" },
  { key: "visa_sponsorship", label: "Visa sponsorship answer" },
  { key: "will_be_18_by_completion", label: "18+ by completion" },
  { key: "status", label: "Admissions stage" },
  { key: "exam_result", label: "Assessment result" },
  { key: "cohort", label: "Cohort" },
  { key: "resume", label: "Resume (download)" },
  { key: "submitted_at", label: "Applied on" },
] as const;
