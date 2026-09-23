import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui";
import { getSession } from "@/lib/session";
import { homeFor } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const links = [
  { href: "/programs/asu-tsmc", label: "ASU-TSMC Program" },
  { href: "/programs/asu-tsmc#curriculum", label: "Curriculum" },
  { href: "/programs/asu-tsmc#cohorts", label: "Cohorts" },
  { href: "/programs/asu-tsmc#faq", label: "FAQ" },
];

export async function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const session = await getSession();
  const dark = overlay;
  return (
    <header
      className={cn(
        "z-40 w-full",
        overlay ? "absolute inset-x-0 top-0" : "sticky top-0 border-b border-ink/10 bg-white/85 backdrop-blur-xl",
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo dark={dark} />
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "text-sm font-bold transition-colors",
                dark ? "text-white/80 hover:text-gold" : "text-ink/70 hover:text-maroon",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          {session ? (
            <ButtonLink href={homeFor(session.roles)} variant={dark ? "outline-light" : "outline"} size="sm">
              My dashboard
            </ButtonLink>
          ) : (
            <Link href="/login" className={cn("text-sm font-bold", dark ? "text-white hover:text-gold" : "text-ink hover:text-maroon")}>
              Sign in
            </Link>
          )}
          <ButtonLink href="/apply/asu-tsmc" size="sm">
            Apply now
          </ButtonLink>
        </div>
        <details className="group relative sm:hidden">
          <summary
            className={cn(
              "flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border",
              dark ? "border-white/30 text-white" : "border-ink/20 text-ink",
            )}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </summary>
          <div className="absolute right-0 top-14 w-64 rounded-2xl border border-ink/10 bg-white p-3 shadow-2xl">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="block rounded-lg px-3 py-2.5 font-bold text-ink hover:bg-mist">
                {l.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-ink/10" />
            {session ? (
              <Link href={homeFor(session.roles)} className="block rounded-lg px-3 py-2.5 font-bold text-ink hover:bg-mist">
                My dashboard
              </Link>
            ) : (
              <Link href="/login" className="block rounded-lg px-3 py-2.5 font-bold text-ink hover:bg-mist">
                Sign in
              </Link>
            )}
            <ButtonLink href="/apply/asu-tsmc" className="mt-2 w-full">
              Apply now
            </ButtonLink>
          </div>
        </details>
      </div>
    </header>
  );
}
