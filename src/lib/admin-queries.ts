import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUSES } from "@/lib/workflow";
import { EDUCATION_LEVELS, VISA_OPTIONS } from "@/lib/validation";

export type QueueFilters = {
  program?: string;
  status?: string;
  visa?: string;
  education?: string;
  q?: string;
  from?: string;
  to?: string;
};

export const QUEUE_SELECT =
  "id, first_name, last_name, email, phone, highest_education, major, visa_sponsorship, will_be_18_by_completion, share_with_employers, status, exam_result, exam_invited_at, exam_self_reported_at, exam_reminders_sent, utm_source, submitted_at, updated_at, resume_path, program_id, programs(short_name, slug), cohorts:assigned_cohort_id(name, start_date)";

/** Builds the admissions queue query from URL filters (shared by the page and CSV export). */
export function queueQuery(supabase: SupabaseClient, f: QueueFilters, select = QUEUE_SELECT) {
  let q = supabase.from("applications").select(select).order("submitted_at", { ascending: false });
  if (f.program) q = q.eq("program_id", f.program);
  if (f.status && (STATUSES as readonly string[]).includes(f.status)) q = q.eq("status", f.status);
  if (f.status === "active") q = q.not("status", "in", "(confirmed,withdrawn,not_selected,exam_failed)");
  if (f.visa && (VISA_OPTIONS as readonly string[]).includes(f.visa)) q = q.eq("visa_sponsorship", f.visa);
  if (f.education && (EDUCATION_LEVELS as readonly string[]).includes(f.education)) q = q.eq("highest_education", f.education);
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) q = q.gte("submitted_at", f.from);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) q = q.lte("submitted_at", `${f.to}T23:59:59`);
  const term = (f.q ?? "").replace(/[^\p{L}\p{N}@.\-_ ]/gu, "").trim();
  if (term) q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  return q;
}
