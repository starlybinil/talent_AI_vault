import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type EmailContext } from "@/lib/email";
import { EMAIL_FOR_STATUS, type EmailTemplate, type Status } from "@/lib/workflow";

type Prog = { short_name: string; employer_partner: string | null; slug: string };

type AppRow = {
  id: string;
  email: string;
  first_name: string;
  status: Status;
  exam_url: string | null;
  assigned_cohort_id: string | null;
  completed_on: string | null;
  completion_note: string | null;
  hired_employer_name: string | null;
  hired_job_title: string | null;
  hired_start_date: string | null;
  programs: Prog | Prog[] | null;
};

/** Load what the email templates need for one application (as the current user). */
export async function emailContext(supabase: SupabaseClient, applicationId: string): Promise<EmailContext | null> {
  const { data } = await supabase
    .from("applications")
    .select(
      "id, email, first_name, status, exam_url, assigned_cohort_id, completed_on, completion_note, hired_employer_name, hired_job_title, hired_start_date, programs(short_name, employer_partner, slug)",
    )
    .eq("id", applicationId)
    .maybeSingle<AppRow>();
  if (!data) return null;
  const program = Array.isArray(data.programs) ? data.programs[0] : data.programs;
  let cohort: EmailContext["cohort"] = null;
  if (data.assigned_cohort_id) {
    const { data: c } = await supabase
      .from("cohorts")
      .select("name, format, start_date, end_date, schedule, location, address")
      .eq("id", data.assigned_cohort_id)
      .maybeSingle();
    cohort = c;
  }
  return {
    applicationId: data.id,
    to: data.email,
    firstName: data.first_name,
    programName: program?.short_name ?? "FoundryReady program",
    employerPartner: program?.employer_partner ?? null,
    programSlug: program?.slug ?? null,
    examUrl: data.exam_url,
    cohort,
    outcome: {
      completedOn: data.completed_on,
      completionNote: data.completion_note,
      employer: data.hired_employer_name,
      jobTitle: data.hired_job_title,
      startDate: data.hired_start_date,
    },
  };
}

/** Send the email that belongs to the application's current status (if any). */
export async function notifyStatus(
  supabase: SupabaseClient,
  applicationId: string,
  opts: { note?: string | null; override?: EmailTemplate } = {},
) {
  const ctx = await emailContext(supabase, applicationId);
  if (!ctx) return;
  const { data } = await supabase.from("applications").select("status").eq("id", applicationId).maybeSingle();
  const template = opts.override ?? EMAIL_FOR_STATUS[(data?.status ?? "submitted") as Status];
  if (!template) return;
  await sendEmail(supabase, template, { ...ctx, note: opts.note ?? null });
}

export async function notifyTemplate(
  supabase: SupabaseClient,
  applicationId: string,
  template: EmailTemplate,
  extra: Partial<EmailContext> = {},
) {
  const ctx = await emailContext(supabase, applicationId);
  if (!ctx) return;
  await sendEmail(supabase, template, { ...ctx, ...extra });
}
