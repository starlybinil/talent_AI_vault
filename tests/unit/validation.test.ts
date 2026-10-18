import { describe, expect, it } from "vitest";
import { applicationSchema, cohortSchema, validateResume } from "@/lib/validation";

const base = {
  program_slug: "asu-tsmc",
  first_name: "Alex",
  last_name: "Rivera",
  phone: "(602) 555-0123",
  highest_education: "hs_ged",
  will_be_18_by_completion: "yes",
  work_authorized: "yes",
  visa_sponsorship: "no",
  work_experience: "0_5",
  stem_degree_completed: "no",
  stem_degree_enrolled: "no",
  role_interest: "yes",
  cleanroom_willing: "unsure",
  shift_willing: "yes",
  pay_range_accepted: "yes",
  share_with_employers: true,
  acknowledged: true,
  resume_path: "uid/resumes/1.pdf",
};

describe("application schema", () => {
  it("accepts a valid application", () => {
    expect(applicationSchema.safeParse(base).success).toBe(true);
  });

  it("requires the acknowledgement", () => {
    expect(applicationSchema.safeParse({ ...base, acknowledged: false }).success).toBe(false);
  });

  it("requires role & pay answers only for programs that ask them", () => {
    const { role_interest: _r, cleanroom_willing: _c, shift_willing: _s, pay_range_accepted: _p, ...noRole } = base;
    void [_r, _c, _s, _p];
    const r = applicationSchema.safeParse(noRole);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["role_interest", "cleanroom_willing", "shift_willing", "pay_range_accepted"]);
    expect(applicationSchema.safeParse({ ...noRole, program_slug: "another-program" }).success).toBe(true);
  });

  it("accepts the deck's education options, including no diploma", () => {
    expect(applicationSchema.safeParse({ ...base, highest_education: "no_hs" }).success).toBe(true);
    expect(applicationSchema.safeParse({ ...base, work_experience: "20" }).success).toBe(false);
  });

  it("rejects bad phone numbers and missing answers", () => {
    expect(applicationSchema.safeParse({ ...base, phone: "12345" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...base, visa_sponsorship: "" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...base, work_authorized: "" }).success).toBe(false);
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

describe("cohortSchema", () => {
  const cohort = {
    program_id: "7f1c1a0e-0a4c-4f7e-9b1a-2f1d3c4b5a60",
    name: "Accelerator · Mar 2027",
    format: "5-Week Accelerator",
    start_date: "2027-03-01",
    end_date: "2027-04-02",
    schedule: "Mon–Fri · 8:00 AM – 4:30 PM",
    location_id: "0b8e7a2c-5d1f-4c3a-8e9b-1a2b3c4d5e6f",
    capacity: "24",
  };
  it("takes the location from the training-locations dropdown", () => {
    expect(cohortSchema.safeParse(cohort).success).toBe(true);
    expect(cohortSchema.safeParse({ ...cohort, location_id: "" }).success).toBe(false);
  });
});
