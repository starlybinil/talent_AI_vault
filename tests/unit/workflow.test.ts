import { describe, expect, it } from "vitest";
import {
  EMAIL_FOR_STATUS,
  STATUSES,
  STAGES,
  applicantNextAction,
  canTransition,
  nextStatuses,
  stageStates,
  canReset,
  PLACEMENT_STATUSES,
} from "@/lib/workflow";

describe("workflow transitions", () => {
  it("follows the happy path end to end", () => {
    const path = [
      "submitted",
      "screening",
      "screening_passed",
      "exam_invited",
      "exam_passed",
      "cohort_selection",
      "cohort_registered",
      "agreements_pending",
      "agreements_submitted",
      "confirmed",
      "completed",
      "hired",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it("supports the waitlist path", () => {
    expect(canTransition("cohort_selection", "waitlisted")).toBe(true);
    expect(canTransition("waitlisted", "cohort_registered")).toBe(true);
  });

  it("blocks skipping steps", () => {
    expect(canTransition("submitted", "exam_invited")).toBe(false);
    expect(canTransition("screening", "confirmed")).toBe(false);
    expect(canTransition("exam_invited", "cohort_selection")).toBe(false);
  });

  it("allows withdrawal at every stage up to and including confirmation", () => {
    for (const s of STATUSES.filter((x) => !["withdrawn", "completed", "hired"].includes(x))) expect(canTransition(s, "withdrawn")).toBe(true);
    expect(canTransition("confirmed", "withdrawn")).toBe(true);
    expect(canTransition("withdrawn", "withdrawn")).toBe(false);
  });

  it("records outcomes in order: confirmed → completed → hired, with one-step undo", () => {
    expect(canTransition("confirmed", "completed")).toBe(true);
    expect(canTransition("completed", "hired")).toBe(true);
    expect(canTransition("confirmed", "hired")).toBe(false);
    expect(canTransition("agreements_submitted", "completed")).toBe(false);
    expect(canTransition("hired", "completed")).toBe(true);
    expect(canTransition("completed", "confirmed")).toBe(true);
    // Graduates and hires can't withdraw or leave their cohort.
    expect(canTransition("completed", "withdrawn")).toBe(false);
    expect(canTransition("hired", "withdrawn")).toBe(false);
    expect(canTransition("completed", "cohort_selection")).toBe(false);
  });

  it("lets applicants leave a cohort to pick another from any seat-holding stage", () => {
    for (const s of ["cohort_registered", "waitlisted", "agreements_pending", "agreements_submitted", "confirmed"] as const)
      expect(canTransition(s, "cohort_selection")).toBe(true);
    expect(canTransition("screening", "cohort_selection")).toBe(false);
  });

  it("lists next statuses including withdraw", () => {
    expect(nextStatuses("agreements_submitted")).toEqual(["agreements_pending", "confirmed", "cohort_selection", "withdrawn"]);
    expect(nextStatuses("confirmed")).toEqual(["cohort_selection", "completed", "withdrawn"]);
    expect(nextStatuses("hired")).toEqual(["completed"]);
    expect(nextStatuses("withdrawn")).toEqual([]);
  });

  it("gives every status a next action and a stage", () => {
    for (const s of STATUSES) {
      expect(applicantNextAction(s).title).toBeTruthy();
      expect(stageStates(s)).toHaveLength(STAGES.length);
    }
  });

  it("marks hired as fully done, confirmed as working toward completion, and rejections as blocked", () => {
    expect(stageStates("hired").every((x) => x === "done")).toBe(true);
    const confirmed = stageStates("confirmed");
    expect(confirmed[STAGES.findIndex((s) => s.key === "confirmed")]).toBe("done");
    expect(confirmed[STAGES.findIndex((s) => s.key === "completed")]).toBe("current");
    expect(stageStates("completed")[STAGES.findIndex((s) => s.key === "hired")]).toBe("current");
    expect(stageStates("exam_failed")).toContain("blocked");
    expect(stageStates("submitted")[0]).toBe("done");
  });

  it("treats choosing cohorts and signing agreements as one Enrollment step", () => {
    const enroll = STAGES.findIndex((s) => s.key === "enroll");
    for (const s of ["exam_passed", "cohort_selection", "waitlisted", "cohort_registered", "agreements_pending"] as const) {
      expect(stageStates(s)[enroll]).toBe("current");
    }
    expect(stageStates("agreements_submitted")[enroll]).toBe("done");
    expect(applicantNextAction("cohort_selection").tab).toBe("enrollment");
    expect(applicantNextAction("waitlisted").tab).toBe("enrollment");
    expect(applicantNextAction("agreements_pending").tab).toBe("enrollment");
  });

  it("emails at the key milestones", () => {
    expect(EMAIL_FOR_STATUS.exam_invited).toBe("exam_invite");
    expect(EMAIL_FOR_STATUS.exam_passed).toBe("exam_passed");
    expect(EMAIL_FOR_STATUS.cohort_selection).toBe("accepted");
    expect(EMAIL_FOR_STATUS.confirmed).toBe("confirmed");
    expect(EMAIL_FOR_STATUS.completed).toBe("program_completed");
    expect(EMAIL_FOR_STATUS.hired).toBe("hired");
  });
});

describe("admissions flow refinements", () => {
  it("acceptance is its own step: passing the assessment doesn't open enrollment", () => {
    expect(EMAIL_FOR_STATUS.exam_passed).toBe("exam_passed");
    expect(EMAIL_FOR_STATUS.cohort_selection).toBe("accepted");
    expect(canTransition("exam_passed", "cohort_selection")).toBe(true);
    expect(applicantNextAction("exam_passed").tab).toBeUndefined();
    expect(applicantNextAction("cohort_selection").tab).toBe("enrollment");
  });

  it("allows a reset from anywhere past screening, except once the program is finished", () => {
    expect(canReset("screening")).toBe(false);
    expect(canReset("submitted")).toBe(false);
    for (const s of ["not_selected", "exam_invited", "exam_failed", "exam_passed", "agreements_submitted", "confirmed", "withdrawn"] as const)
      expect(canReset(s)).toBe(true);
    expect(canReset("completed")).toBe(false);
    expect(canReset("hired")).toBe(false);
  });

  it("admissions places applicants while they hold or wait for a seat", () => {
    expect(PLACEMENT_STATUSES).toEqual(["cohort_registered", "waitlisted", "agreements_pending", "agreements_submitted"]);
  });
});
