import { describe, expect, it } from "vitest";
import { cohortPhase, defaultYear, durationWeeks, meetingDays, meetsOn, packLanes, scheduleYears, yearSpan } from "@/lib/schedule";

const c = (start_date: string, end_date: string, schedule = "Mon–Fri · 8:00 AM – 4:30 PM") => ({ start_date, end_date, schedule });

describe("meetingDays", () => {
  it("reads ranges, plurals and lists", () => {
    expect(meetingDays("Mon–Fri · 8:00 AM – 4:30 PM")).toEqual([1, 2, 3, 4, 5]);
    expect(meetingDays("Mon-Thu · 5:30 PM – 8:30 PM")).toEqual([1, 2, 3, 4]);
    expect(meetingDays("Saturdays · 8:00 AM – 5:00 PM")).toEqual([6]);
    expect(meetingDays("Mon, Wed & Fri · 6 PM")).toEqual([1, 3, 5]);
    expect(meetingDays("Tuesday through Thursday")).toEqual([2, 3, 4]);
    expect(meetingDays("Weekdays · 9 AM")).toEqual([1, 2, 3, 4, 5]);
  });
  it("returns null when no days are named", () => {
    expect(meetingDays("8:00 AM – 4:30 PM")).toBeNull();
  });
});

describe("meetsOn", () => {
  const sat = c("2026-11-07", "2027-03-20", "Saturdays · 8:00 AM – 5:00 PM");
  it("only on meeting days inside the date range", () => {
    expect(meetsOn(sat, "2026-11-07")).toBe(true); // Saturday, first day
    expect(meetsOn(sat, "2026-11-09")).toBe(false); // Monday
    expect(meetsOn(sat, "2027-03-27")).toBe(false); // after the end
  });
});

describe("years and spans", () => {
  const cohorts = [c("2026-10-19", "2026-11-20"), c("2027-11-02", "2028-02-25")];
  it("lists every year a cohort touches", () => {
    expect(scheduleYears(cohorts)).toEqual([2026, 2027, 2028]);
  });
  it("defaults to this year, else the next year with cohorts", () => {
    expect(defaultYear([2026, 2027], "2026-09-23")).toBe(2026);
    expect(defaultYear([2027, 2028], "2026-09-23")).toBe(2027);
  });
  it("clips a cohort that crosses into the next year", () => {
    const s = yearSpan(cohorts[1], 2027)!;
    expect(s.clippedEnd).toBe(true);
    expect(s.clippedStart).toBe(false);
    expect(s.left + s.width).toBeCloseTo(1);
    expect(yearSpan(cohorts[0], 2027)).toBeNull();
  });
  it("stacks overlapping cohorts into lanes", () => {
    const lanes = packLanes([c("2027-01-01", "2027-03-01"), c("2027-02-01", "2027-04-01"), c("2027-03-15", "2027-05-01")]);
    expect(lanes.map((l) => l.length)).toEqual([2, 1]);
  });
});

describe("phase and duration", () => {
  const acc = c("2026-10-19", "2026-11-20");
  it("counts weeks and describes where a cohort is", () => {
    expect(durationWeeks(acc)).toBe(5);
    expect(cohortPhase(acc, "2026-09-23").key).toBe("upcoming");
    expect(cohortPhase(acc, "2026-10-28").label).toBe("In session · week 2 of 5");
    expect(cohortPhase(acc, "2026-12-01").key).toBe("completed");
  });
});
