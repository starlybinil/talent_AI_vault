/**
 * Role-based access control. The database enforces the same rules through RLS and
 * SECURITY DEFINER RPCs; this matrix drives route guards and which UI is shown.
 */

export const ROLES = ["applicant", "employer", "program_admin", "it_admin", "web_developer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  applicant: "Applicant",
  employer: "Employer partner",
  program_admin: "Program admin",
  it_admin: "IT admin",
  web_developer: "Web developer",
};

export const PERMISSIONS = [
  "application.apply",
  "admissions.read",
  "admissions.manage",
  "analytics.read",
  "cohorts.manage",
  "programs.manage",
  "users.manage",
  "audit.read",
  "email_log.read",
  "settings.manage",
  "content.manage",
  "flags.manage",
  "system.read",
  "employer.portal",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  applicant: ["application.apply"],
  employer: ["employer.portal"],
  program_admin: [
    "admissions.read",
    "admissions.manage",
    "analytics.read",
    "cohorts.manage",
    "programs.manage",
    "email_log.read",
  ],
  it_admin: [
    "admissions.read",
    "analytics.read",
    "users.manage",
    "audit.read",
    "email_log.read",
    "settings.manage",
    "flags.manage",
    "system.read",
  ],
  web_developer: ["content.manage", "flags.manage", "system.read"],
};

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  return set;
}

export function can(roles: readonly Role[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

export const STAFF_ROLES: readonly Role[] = ["program_admin", "it_admin", "web_developer"];

export function isStaff(roles: readonly Role[]): boolean {
  return roles.some((r) => STAFF_ROLES.includes(r));
}

/** Where a user lands after signing in, based on their most privileged role. */
export function homeFor(roles: readonly Role[]): string {
  if (isStaff(roles)) return "/admin";
  if (roles.includes("employer")) return "/employer";
  return "/portal";
}

export type NavItem = { href: string; label: string; permission: Permission; icon: string };

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", permission: "analytics.read", icon: "chart" },
  { href: "/admin/applications", label: "Applications", permission: "admissions.read", icon: "inbox" },
  { href: "/admin/cohorts", label: "Cohorts", permission: "cohorts.manage", icon: "calendar" },
  { href: "/admin/locations", label: "Training locations", permission: "cohorts.manage", icon: "map" },
  { href: "/admin/programs", label: "Programs", permission: "programs.manage", icon: "layers" },
  { href: "/admin/agreements", label: "Agreements", permission: "programs.manage", icon: "file" },
  { href: "/admin/users", label: "Users & roles", permission: "users.manage", icon: "users" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.read", icon: "shield" },
  { href: "/admin/email-log", label: "Email log", permission: "email_log.read", icon: "mail" },
  { href: "/admin/settings", label: "Settings", permission: "settings.manage", icon: "settings" },
  { href: "/admin/content", label: "Site content", permission: "content.manage", icon: "pen" },
  { href: "/admin/flags", label: "Feature flags", permission: "flags.manage", icon: "flag" },
  { href: "/admin/system", label: "System health", permission: "system.read", icon: "activity" },
];

/** Route prefix → permission required (longest prefix wins). */
const ROUTE_RULES: Array<[string, Permission | "staff" | "signed_in"]> = [
  ["/admin/applications", "admissions.read"],
  ["/admin/cohorts", "cohorts.manage"],
  ["/admin/locations", "cohorts.manage"],
  ["/admin/programs", "programs.manage"],
  ["/admin/agreements", "programs.manage"],
  ["/admin/users", "users.manage"],
  ["/admin/audit", "audit.read"],
  ["/admin/email-log", "email_log.read"],
  ["/admin/settings", "settings.manage"],
  ["/admin/content", "content.manage"],
  ["/admin/flags", "flags.manage"],
  ["/admin/system", "system.read"],
  ["/admin", "staff"],
  ["/employer", "employer.portal"],
  ["/portal", "signed_in"],
];

export function requirementFor(pathname: string): Permission | "staff" | "signed_in" | null {
  const match = ROUTE_RULES.filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/")).sort(
    (a, b) => b[0].length - a[0].length,
  )[0];
  return match ? match[1] : null;
}

export function isAllowed(roles: readonly Role[], pathname: string): boolean {
  const req = requirementFor(pathname);
  if (req === null || req === "signed_in") return true;
  if (req === "staff") return isStaff(roles);
  return can(roles, req);
}

/** First admin page this user may open (web developers have no dashboard). */
export function firstAdminPage(roles: readonly Role[]): string {
  const perms = permissionsFor(roles);
  return ADMIN_NAV.find((n) => perms.has(n.permission))?.href ?? "/";
}
