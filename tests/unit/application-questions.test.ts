import { describe, expect, it } from "vitest";
import { answerRows } from "@/lib/application-questions";

const labels = { education: { hs_ged: "High school diploma / GED" }, visa: { no: "No", future: "Yes" } };
const marks = (a: Parameters<typeof answerRows>[0]) => Object.fromEntries(answerRows(a, labels).map(([k, , m]) => [k, m]));

describe("admissions check marks", () => {
  it("checks the answers admissions wants and crosses the opposite", () => {
    const ideal = marks({
      will_be_18_by_completion: true, work_authorized: true, visa_sponsorship: "no", highest_education: "hs_ged", work_experience: "0_5",
      stem_degree_completed: "no", stem_degree_enrolled: "no", role_interest: true, cleanroom_willing: "yes", shift_willing: true, pay_range_accepted: true,
    });
    expect(Object.values(ideal).filter((m) => m === true)).toHaveLength(9);
    expect(ideal["Work experience"]).toBeNull();
    expect(ideal["Highest education"]).toBeNull();

    const opposite = marks({
      will_be_18_by_completion: false, work_authorized: false, visa_sponsorship: "future", highest_education: "hs_ged",
      stem_degree_completed: "yes", stem_degree_enrolled: "yes", role_interest: false, cleanroom_willing: "no", shift_willing: false, pay_range_accepted: false,
    });
    expect(Object.values(opposite).filter((m) => m === false)).toHaveLength(9);
  });

  it("leaves Unsure and unanswered questions unmarked", () => {
    const m = marks({ will_be_18_by_completion: null, visa_sponsorship: null, highest_education: null, stem_degree_completed: "unsure", cleanroom_willing: "unsure", role_interest: true });
    expect(m["STEM bachelor’s or higher completed"]).toBeNull();
    expect(m["Willing to work in a cleanroom"]).toBeNull();
    expect(m["18+ by end of program"]).toBeNull();
  });
});
