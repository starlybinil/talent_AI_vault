import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-ink-950 text-white">
      <div className="h-1.5 bg-gradient-to-r from-maroon via-gold to-maroon" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <Logo dark />
          <p className="mt-4 text-lg font-black text-gold">{BRAND.tagline}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">{BRAND.mission}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Programs</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li><Link className="hover:text-white" href="/programs/asu-tsmc">ASU-TSMC Equipment Technician</Link></li>
            <li><Link className="hover:text-white" href="/#programs">All programs</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Account</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li><Link className="hover:text-white" href="/login">Sign in</Link></li>
            <li><Link className="hover:text-white" href="/register">Create account</Link></li>
            <li><Link className="hover:text-white" href="/employer">Employer partners</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-white/40 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} FoundryReady. All rights reserved.</p>
          <p>Program offered in partnership with Arizona State University and TSMC Arizona.</p>
        </div>
      </div>
    </footer>
  );
}
