/** Cohort calendar helpers: date math on YYYY-MM-DD strings (UTC, no timezone drift) and meeting days. */

export type ScheduleCohort = {
  cohort_id: string;
  program_id: string;
  program_name: string;
  name: string;
  format: string;
  start_date: string;
  end_date: string;
  schedule: string;
  location_id: string | null;
  location: string;
  address: string | null;
  capacity: number;
  status: string;
  registered: number;
  /** Confirmed trainees, including those who have since completed or been hired. */
  confirmed: number;
  /** Completed the program (including those hired). */
  completed: number;
  hired: number;
  /** Staff only (null for employers). */
  waitlisted: number | null;
  seats_left: number | null;
};

export type ScheduleAudience = "admin" | "it" | "employer";

const DAY = 86_400_000;

export function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY);
}

export function durationWeeks(c: Pick<ScheduleCohort, "start_date" | "end_date">): number {
  return Math.max(1, Math.round((daysBetween(c.start_date, c.end_date) + 1) / 7));
}

/** Every calendar year a cohort touches, across all cohorts, sorted. */
export function scheduleYears(cohorts: Array<Pick<ScheduleCohort, "start_date" | "end_date">>): number[] {
  const years = new Set<number>();
  for (const c of cohorts) for (let y = yearOf(c.start_date); y <= yearOf(c.end_date); y++) years.add(y);
  return Array.from(years).sort((a, b) => a - b);
}

/** Current year if anything runs in it, otherwise the next year that has cohorts (or the last one). */
export function defaultYear(years: number[], today: string): number {
  const now = yearOf(today);
  if (years.length === 0 || years.includes(now)) return now;
  return years.find((y) => y > now) ?? years[years.length - 1];
}

/** Where a cohort sits inside a year, as fractions of the year (0–1), clipped to the year. */
export function yearSpan(c: Pick<ScheduleCohort, "start_date" | "end_date">, year: number) {
  const ys = Date.UTC(year, 0, 1);
  const ye = Date.UTC(year + 1, 0, 1);
  const s = toUtc(c.start_date);
  const e = toUtc(c.end_date) + DAY;
  if (e <= ys || s >= ye) return null;
  const len = ye - ys;
  return {
    left: (Math.max(s, ys) - ys) / len,
    width: (Math.min(e, ye) - Math.max(s, ys)) / len,
    clippedStart: s < ys,
    clippedEnd: e > ye,
  };
}

/** Packs overlapping cohorts into stacked lanes (greedy, by start date), keeping `gapDays` free after each one. */
export function packLanes<T extends Pick<ScheduleCohort, "start_date" | "end_date">>(items: T[], gapDays = 0): T[][] {
  const lanes: T[][] = [];
  for (const item of [...items].sort((a, b) => a.start_date.localeCompare(b.start_date))) {
    const lane = lanes.find((l) => isoDate(toUtc(l[l.length - 1].end_date) + gapDays * DAY) < item.start_date);
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Weekdays (0 = Sunday) a cohort meets, read from its "Days & times" text, e.g.
 * "Mon–Fri · 8:00 AM – 4:30 PM", "Saturdays · …", "Mon, Wed & Fri". Null when no days are named.
 */
export function meetingDays(schedule: string): number[] | null {
  const daysPart = schedule.split("·")[0].toLowerCase();
  if (/\bdaily\b|every day/.test(daysPart)) return [0, 1, 2, 3, 4, 5, 6];
  if (/\bweekdays?\b/.test(daysPart)) return [1, 2, 3, 4, 5];
  if (/\bweekends?\b/.test(daysPart)) return [0, 6];

  const re = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/g;
  const found: Array<{ day: number; start: number; end: number }> = [];
  for (let m = re.exec(daysPart); m; m = re.exec(daysPart)) {
    found.push({ day: DAY_KEYS.indexOf(m[1] as (typeof DAY_KEYS)[number]), start: m.index, end: m.index + m[0].length });
  }
  if (found.length === 0) return null;

  const days = new Set<number>();
  for (let i = 0; i < found.length; i++) {
    days.add(found[i].day);
    const next = found[i + 1];
    if (next && /^\s*(–|—|-|to|through|thru)\s*$/.test(daysPart.slice(found[i].end, next.start))) {
      for (let d = found[i].day; d !== next.day; d = (d + 1) % 7) days.add(d);
    }
  }
  return Array.from(days).sort((a, b) => a - b);
}

/** The time part of the schedule text ("8:00 AM – 4:30 PM"), if any. */
export function meetingTimes(schedule: string): string | null {
  const parts = schedule.split("·");
  return parts.length > 1 ? parts.slice(1).join("·").trim() : null;
}

/** Does the cohort hold class on this date? */
export function meetsOn(c: Pick<ScheduleCohort, "start_date" | "end_date" | "schedule">, date: string): boolean {
  if (date < c.start_date || date > c.end_date) return false;
  const days = meetingDays(c.schedule);
  return days ? days.includes(new Date(toUtc(date)).getUTCDay()) : true;
}

export type CohortPhase = { key: "upcoming" | "running" | "completed"; label: string };

export function cohortPhase(c: Pick<ScheduleCohort, "start_date" | "end_date">, today: string): CohortPhase {
  if (today < c.start_date) {
    const d = daysBetween(today, c.start_date);
    return { key: "upcoming", label: d === 1 ? "Starts tomorrow" : d < 60 ? `Starts in ${d} days` : `Starts in ${Math.round(d / 30)} months` };
  }
  if (today > c.end_date) return { key: "completed", label: "Completed" };
  const week = Math.floor(daysBetween(c.start_date, today) / 7) + 1;
  return { key: "running", label: `In session · week ${week} of ${durationWeeks(c)}` };
}

/** One colour per format, from the ASU palette. */
const FORMAT_PALETTE = [
  { bg: "#8C1D40", fg: "#FFFFFF" },
  { bg: "#FFC627", fg: "#191919" },
  { bg: "#00A3E0", fg: "#FFFFFF" },
  { bg: "#78BE20", fg: "#191919" },
  { bg: "#FF7F32", fg: "#191919" },
  { bg: "#191919", fg: "#FFFFFF" },
];

export function formatColors(formats: string[]): Record<string, { bg: string; fg: string }> {
  const known = ["accelerator", "intensive", "saturday"];
  const sorted = Array.from(new Set(formats)).sort((a, b) => {
    const ia = known.findIndex((k) => a.toLowerCase().includes(k));
    const ib = known.findIndex((k) => b.toLowerCase().includes(k));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  return Object.fromEntries(sorted.map((f, i) => [f, FORMAT_PALETTE[i % FORMAT_PALETTE.length]]));
}

export function shortDate(date: string, withYear = true): string {
  return new Date(toUtc(date)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function dateRange(c: Pick<ScheduleCohort, "start_date" | "end_date">): string {
  const sameYear = yearOf(c.start_date) === yearOf(c.end_date);
  return `${shortDate(c.start_date, !sameYear)} – ${shortDate(c.end_date)}`;
}

/** Arizona has no daylight saving, so "today" is stable for the program's region. */
export function todayInArizona(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
}
