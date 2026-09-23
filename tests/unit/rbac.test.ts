import { describe, expect, it } from "vitest";
import { can, firstAdminPage, homeFor, isAllowed } from "@/lib/rbac";

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
