/** Cohort tracking math: module grades, attendance and at-risk flags. Pure functions (unit tested). */
import { isoDate, meetingDays, toUtc } from "@/lib/schedule";

export const GRADE_MIN = 70;
export const ATTENDANCE_MIN = 90;

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = { present: "Present", late: "Late", absent: "Absent", excused: "Excused" };

/** Statuses that count as "in the cohort" for tracking. */
export const TRAINEE_STATUSES = ["confirmed", "completed", "hired"] as const;

export type Module = { id: string; name: string; sort: number };
export type Grade = { module_id: string; application_id: string; score: number };
export type Session = { id: string; session_date: string; canceled: boolean; note?: string | null };
export type Mark = { session_id: string; application_id: string; status: AttendanceStatus };

export type StudentStats = {
  /** Average of the module scores entered so far (null if none). */
  grade: number | null;
  graded: number;
  /** (present + late) ÷ (present + late + absent) over sessions held; excused don't count. Null if none recorded. */
  attendance: number | null;
  present: number;
  late: number;
  absent: number;
  excused: number;
  lowGrade: boolean;
  lowAttendance: boolean;
  atRisk: boolean;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function studentStats(appId: string, modules: Module[], grades: Grade[], sessions: Session[], marks: Mark[], today: string): StudentStats {
  const moduleIds = new Set(modules.map((m) => m.id));
  const scores = grades.filter((g) => g.application_id === appId && moduleIds.has(g.module_id)).map((g) => Number(g.score));
  const held = new Set(sessions.filter((s) => !s.canceled && s.session_date <= today).map((s) => s.id));
  const mine = marks.filter((m) => m.application_id === appId && held.has(m.session_id));
  const count = (st: AttendanceStatus) => mine.filter((m) => m.status === st).length;
  return statsFromCounts({
    grade: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    graded: scores.length,
    present: count("present"),
    late: count("late"),
    absent: count("absent"),
    excused: count("excused"),
  });
}

/** Flags and percentages from totals (as returned by the tracking_student_stats database function). */
export function statsFromCounts(c: { grade: number | string | null; graded: number; present: number; late: number; absent: number; excused: number }): StudentStats {
  const grade = c.grade === null || c.grade === undefined ? null : round1(Number(c.grade));
  const counted = c.present + c.late + c.absent;
  const attendance = counted ? round1(((c.present + c.late) / counted) * 100) : null;
  const lowGrade = grade !== null && grade < GRADE_MIN;
  const lowAttendance = attendance !== null && attendance < ATTENDANCE_MIN;
  return { grade, graded: c.graded, attendance, present: c.present, late: c.late, absent: c.absent, excused: c.excused, lowGrade, lowAttendance, atRisk: lowGrade || lowAttendance };
}

/** Average of a module's scores across the cohort. */
export function moduleAverage(moduleId: string, grades: Grade[]): number | null {
  const xs = grades.filter((g) => g.module_id === moduleId).map((g) => Number(g.score));
  return xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

/** Every date the cohort meets, from its dates and meeting days (e.g. "Mon–Fri", "Saturdays"); weekdays if none named. */
export function sessionDates(cohort: { start_date: string; end_date: string; schedule: string }): string[] {
  const days = meetingDays(cohort.schedule) ?? [1, 2, 3, 4, 5];
  const out: string[] = [];
  for (let t = toUtc(cohort.start_date); t <= toUtc(cohort.end_date); t += 86_400_000) {
    if (days.includes(new Date(t).getUTCDay())) out.push(isoDate(t));
  }
  return out;
}

/** Parse a score typed into the grade grid: "" clears it; otherwise 0–100, up to two decimals. */
export function parseScore(raw: string): number | null | "invalid" {
  const v = raw.trim().replace(/%$/, "");
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return "invalid";
  return Math.round(n * 100) / 100;
}
