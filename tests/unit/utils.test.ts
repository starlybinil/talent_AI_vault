import { describe, expect, it } from "vitest";
import { csvEscape, safeNext, toCsv } from "@/lib/utils";
import { buildIcs } from "@/lib/ics";

describe("csv", () => {
  it("quotes and neutralizes formulas", () => {
    expect(csvEscape('a,"b"')).toBe('"a,""b"""');
    expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(toCsv(["x"], [[null], [1]])).toBe("x\r\n\r\n1");
  });
});

describe("safeNext", () => {
  it("only allows same-site paths", () => {
    expect(safeNext("/portal/apply/asu-tsmc")).toBe("/portal/apply/asu-tsmc");
    expect(safeNext("//evil.com")).toBe("/portal");
    expect(safeNext("https://evil.com")).toBe("/portal");
    expect(safeNext(null, "/x")).toBe("/x");
  });
});

describe("ics", () => {
  it("builds an all-day event on the start date", () => {
    const ics = buildIcs("ASU-TSMC", {
      name: "Accelerator",
      start_date: "2026-10-19",
      end_date: "2026-11-20",
      schedule: "Mon–Fri",
      location: "Tempe",
      address: "ASU, Tempe, AZ",
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261019");
    expect(ics).toContain("DTEND;VALUE=DATE:20261020");
    expect(ics).toContain("LOCATION:Tempe\\, ASU\\, Tempe\\, AZ");
  });
});
