import { describe, expect, it } from "vitest";
import { pickFeatured, programCopy } from "@/lib/program";

describe("programCopy", () => {
  it("uses a program's own partners and outcome", () => {
    const c = programCopy({
      name: "ASU-TSMC Foundations",
      academic_partner: "Arizona State University",
      employer_partner: "TSMC Arizona",
      outcome_badge: "TSMC",
      outcome_title: "A guaranteed TSMC Arizona interview",
    });
    expect(c.partners).toBe("Arizona State University × TSMC Arizona");
    expect(c.outcomeBadge).toBe("TSMC");
    expect(c.pitch).toContain("Built with TSMC Arizona.");
  });

  it("falls back to generic copy that names no partner", () => {
    const c = programCopy({ name: "New program" });
    expect(c.partners).toBeNull();
    expect(c.employerOrGeneric).toBe("the employer partner");
    expect(c.outcomeBadge).toBeNull();
    expect(c.audiences.length).toBeGreaterThan(0);
    expect(JSON.stringify(c)).not.toMatch(/TSMC|ASU/);
  });

  it("builds an outcome line from a new employer partner", () => {
    const c = programCopy({ name: "ASU-Amkor", employer_partner: "Amkor Technology" });
    expect(c.outcomeTitle).toBe("An interview pathway with Amkor Technology");
  });
});

describe("pickFeatured", () => {
  const programs = [
    { slug: "a", active: false, featured: true },
    { slug: "b", active: true, featured: false },
    { slug: "c", active: true, featured: true },
  ];
  it("prefers an active featured program", () => expect(pickFeatured(programs)?.slug).toBe("c"));
  it("falls back to the first active program", () => expect(pickFeatured(programs.slice(0, 2))?.slug).toBe("b"));
  it("returns nothing when no program is active", () => expect(pickFeatured(programs.slice(0, 1))).toBeUndefined());
});
