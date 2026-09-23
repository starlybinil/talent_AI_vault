import { z } from "zod";
import { DEGREE_LEVELS } from "@/lib/workflow";

export const EDUCATION_LEVELS = ["hs_ged", "some_college", "certificate", "associate", "bachelor", "master_plus"] as const;
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
    highest_education: z.enum(EDUCATION_LEVELS, { message: "Select your highest diploma or degree" }),
    major: z.string().trim().max(120).optional().default(""),
    visa_sponsorship: z.enum(VISA_OPTIONS, { message: "Tell us whether you need visa sponsorship" }),
    will_be_18_by_completion: z.enum(["yes", "no"], { message: "Please answer the age question" }),
    share_with_employers: z.boolean().default(false),
    resume_path: z.string().min(1, "Please upload your resume"),
  })
  .superRefine((v, ctx) => {
    if ((DEGREE_LEVELS as readonly string[]).includes(v.highest_education) && !v.major) {
      ctx.addIssue({ code: "custom", path: ["major"], message: "Enter your program major" });
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
  location: z.string().trim().min(2).max(120),
  address: z.string().trim().max(200).optional().default(""),
  capacity: z.coerce.number().int().min(0).max(1000),
  status: z.enum(["open", "closed", "archived"]).default("open"),
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
