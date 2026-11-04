import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { TRAINEE_STATUSES, statsFromCounts, type StudentStats } from "@/lib/tracking";
import type { Status } from "@/lib/workflow";

export type Trainee = { id: string; first_name: string; last_name: string; email: string; phone: string | null; status: Status };
export type TrackedCohort = {
  id: string;
  name: string;
  format: string;
  start_date: string;
  end_date: string;
  schedule: string;
  location: string;
  status: string;
  program_id: string;
  programs: { short_name: string; employer_partner: string | null } | null;
};

const COHORT_COLS = "id, name, format, start_date, end_date, schedule, location, status, program_id, programs(short_name, employer_partner)";

/** Cohorts this user tracks: every cohort for program admins, otherwise cohorts in their assigned programs. */
export async function trackedCohorts(supabase: SupabaseClient, userId: string, isProgramAdmin: boolean): Promise<TrackedCohort[]> {
  let q = supabase.from("cohorts").select(COHORT_COLS).neq("status", "archived").order("start_date");
  if (!isProgramAdmin) {
    const { data: mine } = await supabase.from("cohort_manager_programs").select("program_id").eq("user_id", userId);
    const ids = (mine ?? []).map((m) => m.program_id as string);
    if (!ids.length) return [];
    q = q.in("program_id", ids);
  }
  const { data } = await q;
  return (data ?? []) as unknown as TrackedCohort[];
}

export async function trackedCohort(supabase: SupabaseClient, id: string): Promise<TrackedCohort | null> {
  const { data } = await supabase.from("cohorts").select(COHORT_COLS).eq("id", id).maybeSingle();
  return (data as unknown as TrackedCohort) ?? null;
}

export async function cohortRoster(supabase: SupabaseClient, cohortId: string): Promise<Trainee[]> {
  const { data } = await supabase
    .from("applications")
    .select("id, first_name, last_name, email, phone, status")
    .eq("assigned_cohort_id", cohortId)
    .in("status", [...TRAINEE_STATUSES])
    .order("last_name")
    .order("first_name");
  return (data ?? []) as Trainee[];
}

/** Grade average, attendance and flags for every trainee in the given cohorts, keyed by application id. */
export async function statsByStudent(supabase: SupabaseClient, cohortIds: string[]): Promise<Map<string, StudentStats & { cohortId: string }>> {
  const out = new Map<string, StudentStats & { cohortId: string }>();
  if (!cohortIds.length) return out;
  const { data } = await supabase.rpc("tracking_student_stats", { p_cohorts: cohortIds });
  for (const r of (data ?? []) as Array<{ application_id: string; cohort_id: string; grade: number | null; graded: number; present: number; late: number; absent: number; excused: number }>) {
    out.set(r.application_id, { ...statsFromCounts(r), cohortId: r.cohort_id });
  }
  return out;
}

/** Fetch every row of a query in pages of 1,000 (the API's per-request cap). */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
