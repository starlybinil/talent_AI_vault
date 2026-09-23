import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import type { Session } from "@/lib/session";
import { ROLE_LABEL, homeFor, isStaff } from "@/lib/rbac";

/** Top bar shared by the applicant portal, employer portal and admin console. */
export function AppHeader({ session, area }: { session: Session; area: "portal" | "employer" | "admin" }) {
  const switchers: Array<{ href: string; label: string }> = [];
  if (area !== "admin" && isStaff(session.roles)) switchers.push({ href: "/admin", label: "Admin console" });
  if (area !== "employer" && session.roles.includes("employer")) switchers.push({ href: "/employer", label: "Employer portal" });
  if (area !== "portal" && session.roles.includes("applicant")) switchers.push({ href: "/portal", label: "My applications" });

  const primaryRole = session.roles.find((r) => r !== "applicant") ?? session.roles[0];
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Logo dark href={homeFor(session.roles)} />
          <span className="hidden rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold md:inline">
            {area === "portal" ? "Applicant portal" : area === "employer" ? "Employer portal" : "Admin console"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {switchers.map((s) => (
            <Link key={s.href} href={s.href} className="hidden text-sm font-bold text-white/70 hover:text-gold sm:inline">
              {s.label}
            </Link>
          ))}
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-bold">{session.fullName || session.email}</p>
            {primaryRole && <p className="text-xs text-white/50">{ROLE_LABEL[primaryRole]}</p>}
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-white/20 px-3 text-sm font-bold hover:border-gold hover:text-gold"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-maroon via-gold to-maroon" />
    </header>
  );
}
