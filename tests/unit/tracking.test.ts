import { describe, expect, it } from "vitest";
import { parseScore, sessionDates, studentStats, type Mark, type Session } from "@/lib/tracking";

const modules = [{ id: "m1", name: "Electrical", sort: 0 }, { id: "m2", name: "Vacuum", sort: 1 }];
const sessions: Session[] = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, session_date: `2027-03-${String(i + 1).padStart(2, "0")}`, canceled: false }));

describe("student stats", () => {
  it("averages module scores and flags below 70%", () => {
    const s = studentStats("a", modules, [{ module_id: "m1", application_id: "a", score: 60 }, { module_id: "m2", application_id: "a", score: 75 }], [], [], "2027-04-01");
    expect(s.grade).toBe(67.5);
    expect(s.lowGrade).toBe(true);
    expect(s.attendance).toBeNull();
  });

  it("counts late as present, ignores excused, flags below 90%", () => {
    const marks: Mark[] = sessions.map((x, i) => ({ session_id: x.id, application_id: "a", status: i < 7 ? "present" : i === 7 ? "late" : i === 8 ? "excused" : "absent" }));
    const s = studentStats("a", modules, [], sessions, marks, "2027-04-01");
    expect(s).toMatchObject({ present: 7, late: 1, excused: 1, absent: 1, attendance: 88.9, lowAttendance: true, atRisk: true });
  });

  it("ignores canceled and future sessions", () => {
    const ss: Session[] = [{ ...sessions[0] }, { ...sessions[1], canceled: true }, { ...sessions[2] }];
    const marks: Mark[] = [{ session_id: "s0", application_id: "a", status: "present" }, { session_id: "s1", application_id: "a", status: "absent" }, { session_id: "s2", application_id: "a", status: "absent" }];
    expect(studentStats("a", modules, [], ss, marks, "2027-03-02").attendance).toBe(100);
  });
});

describe("session dates", () => {
  it("follows meeting days", () => {
    expect(sessionDates({ start_date: "2027-03-01", end_date: "2027-03-14", schedule: "Mon–Fri · 8:00 AM" })).toHaveLength(10);
    expect(sessionDates({ start_date: "2027-03-01", end_date: "2027-03-31", schedule: "Saturdays · 9 AM" })).toEqual(["2027-03-06", "2027-03-13", "2027-03-20", "2027-03-27"]);
    expect(sessionDates({ start_date: "2027-03-01", end_date: "2027-03-07", schedule: "TBD" })).toHaveLength(5);
  });
});

describe("parseScore", () => {
  it("accepts 0-100, blank clears", () => {
    expect(parseScore("85")).toBe(85);
    expect(parseScore("92.5%")).toBe(92.5);
    expect(parseScore("")).toBeNull();
    expect(parseScore("105")).toBe("invalid");
    expect(parseScore("abc")).toBe("invalid");
  });
});

import { latenessSummary, weekStart, weeklyTrend } from "@/lib/tracking";

describe("lateness trends", () => {
  it("groups by week starting Monday", () => {
    expect(weekStart("2027-03-03")).toBe("2027-03-01");
    expect(weekStart("2027-03-07")).toBe("2027-03-01");
    const w = weeklyTrend(
      [
        { date: "2027-03-01", status: "present" },
        { date: "2027-03-02", status: "late" },
        { date: "2027-03-08", status: "late" },
        { date: "2027-03-09", status: "excused" },
      ],
      "2027-04-01",
    );
    expect(w).toEqual([
      { week: "2027-03-01", sessions: 2, late: 1, absent: 0, present: 1 },
      { week: "2027-03-08", sessions: 1, late: 1, absent: 0, present: 0 },
    ]);
  });

  it("summarizes the last 10 sessions and the direction", () => {
    const early = Array.from({ length: 10 }, (_, i) => ({ date: `2027-03-${String(i + 1).padStart(2, "0")}`, status: "present" as const, minutes_after_open: 2 }));
    const recent = Array.from({ length: 10 }, (_, i) => ({ date: `2027-03-${String(i + 15).padStart(2, "0")}`, status: (i < 4 ? "late" : "present") as "late" | "present", minutes_after_open: i < 4 ? 14 : 3 }));
    const s = latenessSummary([...early, ...recent], "2027-04-01");
    expect(s).toMatchObject({ sessions: 20, late: 4, lateRate: 20, recentLate: 4, recentCount: 10, trend: "worse" });
    expect(s.avgMinutesAfterOpen).toBe(4.7);
  });
});
