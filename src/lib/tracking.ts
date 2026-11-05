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

// --- Lateness trends -------------------------------------------------------------------------------------------

export type DayMark = { date: string; status: AttendanceStatus; minutes_after_open?: number | null };
export type WeekTrend = { week: string; sessions: number; late: number; absent: number; present: number };

/** Monday of the week containing a YYYY-MM-DD date. */
export function weekStart(date: string): string {
  const t = toUtc(date);
  const dow = new Date(t).getUTCDay();
  return isoDate(t - ((dow + 6) % 7) * 86_400_000);
}

/** Per-week counts for one trainee's marks (oldest week first). */
export function weeklyTrend(marks: DayMark[], today: string): WeekTrend[] {
  const weeks = new Map<string, WeekTrend>();
  for (const m of marks) {
    if (m.date > today) continue;
    const w = weekStart(m.date);
    const row = weeks.get(w) ?? { week: w, sessions: 0, late: 0, absent: 0, present: 0 };
    if (m.status !== "excused") row.sessions++;
    if (m.status === "late") row.late++;
    else if (m.status === "absent") row.absent++;
    else if (m.status === "present") row.present++;
    weeks.set(w, row);
  }
  return Array.from(weeks.values()).sort((a, b) => a.week.localeCompare(b.week));
}

/** Headline lateness numbers: lates in the last 10 sessions, overall rate, and whether it's getting worse. */
export function latenessSummary(marks: DayMark[], today: string) {
  const held = marks.filter((m) => m.date <= today && m.status !== "excused").sort((a, b) => a.date.localeCompare(b.date));
  const last10 = held.slice(-10);
  const late = held.filter((m) => m.status === "late").length;
  const recentLate = last10.filter((m) => m.status === "late").length;
  const earlier = held.slice(0, -10);
  const earlierRate = earlier.length ? earlier.filter((m) => m.status === "late").length / earlier.length : null;
  const recentRate = last10.length ? recentLate / last10.length : 0;
  const trend: "worse" | "better" | "steady" | null =
    earlierRate === null ? null : recentRate > earlierRate + 0.1 ? "worse" : recentRate < earlierRate - 0.1 ? "better" : "steady";
  const qrMinutes = held.map((m) => m.minutes_after_open).filter((v): v is number => typeof v === "number");
  return {
    sessions: held.length,
    late,
    lateRate: held.length ? Math.round((late / held.length) * 100) : null,
    recentLate,
    recentCount: last10.length,
    trend,
    avgMinutesAfterOpen: qrMinutes.length ? Math.round((qrMinutes.reduce((a, b) => a + b, 0) / qrMinutes.length) * 10) / 10 : null,
  };
}
