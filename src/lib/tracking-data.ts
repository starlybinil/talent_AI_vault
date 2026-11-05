import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { TRAINEE_STATUSES, statsFromCounts, type DayMark, type StudentStats } from "@/lib/tracking";
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

/** Every trainee's attendance marks in a cohort (with session dates), keyed by application id. */
export async function cohortMarks(supabase: SupabaseClient, cohortId: string): Promise<Map<string, DayMark[]>> {
  type Row = { application_id: string; status: DayMark["status"]; minutes_after_open: number | null; cohort_sessions: { session_date: string } | null };
  const rows = await fetchAll<Row>((from, to) =>
    supabase
      .from("session_attendance")
      .select("application_id, status, minutes_after_open, cohort_sessions!inner(session_date, cohort_id, canceled)")
      .eq("cohort_sessions.cohort_id", cohortId)
      .eq("cohort_sessions.canceled", false)
      .order("session_id")
      .order("application_id")
      .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: unknown }>,
  );
  const out = new Map<string, DayMark[]>();
  for (const r of rows) {
    if (!r.cohort_sessions) continue;
    const list = out.get(r.application_id) ?? [];
    list.push({ date: r.cohort_sessions.session_date, status: r.status, minutes_after_open: r.minutes_after_open });
    out.set(r.application_id, list);
  }
  return out;
}

/** A cohort's attendance totals per week, for the cohort-level lateness chart. */
export async function cohortWeeks(supabase: SupabaseClient, cohortId: string) {
  const { data } = await supabase.rpc("cohort_weekly_attendance", { p_cohort: cohortId });
  return ((data ?? []) as Array<{ week_start: string; sessions: number; present: number; late: number; absent: number; excused: number }>).map((w) => ({
    week: w.week_start,
    sessions: w.present + w.late + w.absent,
    present: w.present,
    late: w.late,
    absent: w.absent,
  }));
}
