import { describe, expect, it } from "vitest";
import {
  EMAIL_FOR_STATUS,
  STATUSES,
  STAGES,
  applicantNextAction,
  canTransition,
  nextStatuses,
  stageStates,
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

  it("allows withdrawal at every stage, including after confirmation", () => {
    for (const s of STATUSES.filter((x) => x !== "withdrawn")) expect(canTransition(s, "withdrawn")).toBe(true);
    expect(canTransition("confirmed", "withdrawn")).toBe(true);
    expect(canTransition("withdrawn", "withdrawn")).toBe(false);
  });

  it("lets applicants leave a cohort to pick another from any seat-holding stage", () => {
    for (const s of ["cohort_registered", "waitlisted", "agreements_pending", "agreements_submitted", "confirmed"] as const)
      expect(canTransition(s, "cohort_selection")).toBe(true);
    expect(canTransition("screening", "cohort_selection")).toBe(false);
  });

  it("lists next statuses including withdraw", () => {
    expect(nextStatuses("agreements_submitted")).toEqual(["agreements_pending", "confirmed", "cohort_selection", "withdrawn"]);
    expect(nextStatuses("confirmed")).toEqual(["cohort_selection", "withdrawn"]);
    expect(nextStatuses("withdrawn")).toEqual([]);
  });

  it("gives every status a next action and a stage", () => {
    for (const s of STATUSES) {
      expect(applicantNextAction(s).title).toBeTruthy();
      expect(stageStates(s)).toHaveLength(STAGES.length);
    }
  });

  it("marks confirmed as fully done and rejections as blocked", () => {
    expect(stageStates("confirmed").every((x) => x === "done")).toBe(true);
    expect(stageStates("exam_failed")).toContain("blocked");
    expect(stageStates("submitted")[0]).toBe("done");
  });

  it("emails at the key milestones", () => {
    expect(EMAIL_FOR_STATUS.exam_invited).toBe("exam_invite");
    expect(EMAIL_FOR_STATUS.cohort_selection).toBe("exam_passed");
    expect(EMAIL_FOR_STATUS.confirmed).toBe("confirmed");
  });
});
