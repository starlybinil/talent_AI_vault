import { describe, expect, it } from "vitest";
import { can, firstAdminPage, homeFor, isAllowed, postLoginDestination } from "@/lib/rbac";

describe("rbac", () => {
  it("routes each role to its home", () => {
    expect(homeFor(["applicant"])).toBe("/portal");
    expect(homeFor(["employer"])).toBe("/employer");
    expect(homeFor(["program_admin"])).toBe("/admin");
    expect(homeFor(["web_developer"])).toBe("/admin");
  });

  it("keeps web developers away from applicant data", () => {
    expect(can(["web_developer"], "admissions.read")).toBe(false);
    expect(isAllowed(["web_developer"], "/admin/applications")).toBe(false);
    expect(isAllowed(["web_developer"], "/admin/content")).toBe(true);
    expect(firstAdminPage(["web_developer"])).toBe("/admin/content");
  });

  it("lets IT admins read but not manage admissions", () => {
    expect(can(["it_admin"], "admissions.read")).toBe(true);
    expect(can(["it_admin"], "admissions.manage")).toBe(false);
    expect(isAllowed(["it_admin"], "/admin/users")).toBe(true);
    expect(isAllowed(["it_admin"], "/admin/cohorts")).toBe(true);
    expect(can(["it_admin"], "cohorts.manage")).toBe(false);
    expect(isAllowed(["web_developer"], "/admin/cohorts")).toBe(false);
  });

  it("stops program admins from managing users", () => {
    expect(isAllowed(["program_admin"], "/admin/users")).toBe(false);
    expect(isAllowed(["program_admin"], "/admin/applications/abc")).toBe(true);
    expect(isAllowed(["program_admin"], "/admin/locations")).toBe(true);
    expect(isAllowed(["web_developer"], "/admin/locations")).toBe(false);
  });

  it("gates the employer portal and admin console", () => {
    expect(isAllowed(["applicant"], "/employer")).toBe(false);
    expect(isAllowed(["employer"], "/employer/candidates")).toBe(true);
    expect(isAllowed(["employer"], "/admin")).toBe(false);
    expect(isAllowed(["applicant"], "/portal/apply/asu-tsmc")).toBe(true);
    expect(isAllowed([], "/programs/asu-tsmc")).toBe(true);
  });
});

describe("postLoginDestination", () => {
  it("sends staff to the admin console even when next points into the applicant portal", () => {
    expect(postLoginDestination(["program_admin"], "/portal/apply/asu-tsmc")).toBe("/admin");
    expect(postLoginDestination(["program_admin"], "/portal/applications/123")).toBe("/admin");
    expect(postLoginDestination(["it_admin"], "/portal")).toBe("/admin");
  });
  it("sends employers to the employer console instead of the portal", () => {
    expect(postLoginDestination(["employer"], "/portal/practice")).toBe("/employer");
  });
  it("honors next inside the user's own area", () => {
    expect(postLoginDestination(["program_admin"], "/admin/applications/9")).toBe("/admin/applications/9");
    expect(postLoginDestination(["employer"], "/employer/candidates")).toBe("/employer/candidates");
    expect(postLoginDestination(["applicant"], "/portal/apply/asu-tsmc")).toBe("/portal/apply/asu-tsmc");
  });
  it("ignores next the user may not open, or off-site links", () => {
    expect(postLoginDestination(["applicant"], "/admin")).toBe("/portal");
    expect(postLoginDestination(["program_admin"], "//evil.example")).toBe("/admin");
    expect(postLoginDestination([], null)).toBe("/portal");
  });
});
