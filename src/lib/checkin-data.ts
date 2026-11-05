import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cohortRoster, statsByStudent, trackedCohort, type TrackedCohort, type Trainee } from "@/lib/tracking-data";
import type { AttendanceStatus, StudentStats } from "@/lib/tracking";

export type SessionMark = {
  application_id: string;
  status: AttendanceStatus;
  source: "manual" | "qr";
  checked_in_at: string | null;
  minutes_after_open: number | null;
  distance_m: number | null;
  flag: string | null;
  flag_reviewed_at: string | null;
};
export type CheckinWindow = { id: string; opened_at: string; late_after: string; closes_at: string; closed_at: string | null; require_location: boolean };

export type SessionContext = {
  session: { id: string; session_date: string; canceled: boolean; cohort_id: string };
  cohort: TrackedCohort;
  manages: boolean;
  teaches: boolean;
  canRun: boolean;
  roster: Trainee[];
  stats: Map<string, StudentStats & { cohortId: string }>;
  marks: SessionMark[];
  window: CheckinWindow | null;
  program: { checkin_location: boolean; checkin_window_minutes: number; checkin_late_minutes: number; missed_session_email: boolean } | null;
};

/** Everything a check-in session screen needs, or null if this user may not see the session. */
export async function loadSessionContext(supabase: SupabaseClient, sessionId: string): Promise<SessionContext | null> {
  const { data: session } = await supabase.from("cohort_sessions").select("id, session_date, canceled, cohort_id").eq("id", sessionId).maybeSingle();
  if (!session) return null;
  const [{ data: manages }, { data: teaches }, { data: canRun }] = await Promise.all([
    supabase.rpc("manages_cohort", { p_cohort: session.cohort_id }),
    supabase.rpc("teaches_cohort", { p_cohort: session.cohort_id }),
    supabase.rpc("can_run_checkin", { p_session: sessionId }),
  ]);
  if (!manages && !teaches) return null;
  const cohort = await trackedCohort(supabase, session.cohort_id);
  if (!cohort) return null;
  const [roster, stats, { data: marks }, { data: windows }, { data: program }] = await Promise.all([
    cohortRoster(supabase, session.cohort_id),
    statsByStudent(supabase, [session.cohort_id]),
    supabase
      .from("session_attendance")
      .select("application_id, status, source, checked_in_at, minutes_after_open, distance_m, flag, flag_reviewed_at")
      .eq("session_id", sessionId),
    supabase.from("session_checkins").select("id, opened_at, late_after, closes_at, closed_at, require_location").eq("session_id", sessionId).order("opened_at", { ascending: false }).limit(1),
    supabase.from("programs").select("checkin_location, checkin_window_minutes, checkin_late_minutes, missed_session_email").eq("id", cohort.program_id).maybeSingle(),
  ]);
  return {
    session,
    cohort,
    manages: !!manages,
    teaches: !!teaches,
    canRun: !!canRun,
    roster,
    stats,
    marks: (marks ?? []) as SessionMark[],
    window: ((windows ?? [])[0] as CheckinWindow) ?? null,
    program: program ?? null,
  };
}

/** Cohorts the signed-in instructor teaches (via the Instructor directory). */
export async function myTeachingCohortIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase.from("instructors").select("id, cohort_instructors(cohort_id)").eq("user_id", userId).eq("active", true);
  return Array.from(new Set((data ?? []).flatMap((i) => ((i.cohort_instructors ?? []) as Array<{ cohort_id: string }>).map((c) => c.cohort_id))));
}

export const isOpen = (w: CheckinWindow | null) => !!w && !w.closed_at && new Date(w.closes_at).getTime() > Date.now();
