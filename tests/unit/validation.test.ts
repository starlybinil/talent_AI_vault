import { describe, expect, it } from "vitest";
import { applicationSchema, validateResume } from "@/lib/validation";

const base = {
  program_slug: "asu-tsmc",
  first_name: "Alex",
  last_name: "Rivera",
  phone: "(602) 555-0123",
  highest_education: "hs_ged",
  major: "",
  visa_sponsorship: "no",
  will_be_18_by_completion: "yes",
  share_with_employers: true,
  resume_path: "uid/resumes/1.pdf",
};

describe("application schema", () => {
  it("accepts a valid application", () => {
    expect(applicationSchema.safeParse(base).success).toBe(true);
  });

  it("requires a major when a degree was earned", () => {
    const r = applicationSchema.safeParse({ ...base, highest_education: "bachelor" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path[0]).toBe("major");
    expect(applicationSchema.safeParse({ ...base, highest_education: "bachelor", major: "EE" }).success).toBe(true);
  });

  it("rejects bad phone numbers and missing answers", () => {
    expect(applicationSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...base, visa_sponsorship: "" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...base, resume_path: "" }).success).toBe(false);
  });
});

describe("resume validation", () => {
  it("checks type and size", () => {
    expect(validateResume({ size: 1000, type: "application/pdf", name: "cv.pdf" })).toBeNull();
    expect(validateResume({ size: 6 * 1024 * 1024, type: "application/pdf", name: "cv.pdf" })).toMatch(/5 MB/);
    expect(validateResume({ size: 1000, type: "image/jpeg", name: "cv.jpg" })).toMatch(/PDF or Word/);
  });
});
