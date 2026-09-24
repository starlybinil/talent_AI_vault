import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * FoundryReady "FR" monogram: gold letters on a maroon tile, with a molten "cast bar" underneath
 * (a freshly poured ingot: skills formed and ready). Solid fills only, so many logos can share a page.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="40" height="40" rx="10" fill="#8C1D40" />
      {/* F */}
      <path d="M8 27V8h10.6v4.2h-6.3v3.4h5.4v4.2h-5.4V27z" fill="#FFC627" />
      {/* R */}
      <rect x="20.4" y="8" width="4.3" height="19" fill="#FFC627" />
      <path d="M22.4 10.15H26.4a3.7 3.7 0 0 1 0 7.4H22.4" fill="none" stroke="#FFC627" strokeWidth="4.3" />
      <path d="M26.2 17.6 31.8 27" stroke="#FFC627" strokeWidth="4.4" />
      {/* cast bar: a poured ingot, glowing at one end */}
      <rect x="8" y="30.2" width="24" height="3.4" rx="1.7" fill="#FFC627" />
      <rect x="27.5" y="30.2" width="4.5" height="3.4" rx="1.7" fill="#FF7F32" />
    </svg>
  );
}

export function Wordmark({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={cn("font-black tracking-tight", dark ? "text-white" : "text-ink", className)}>
      Foundry<span className={dark ? "text-gold" : "text-maroon"}>Ready</span>
    </span>
  );
}

export function Logo({ dark = false, className, href = "/" }: { dark?: boolean; className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label={`${BRAND.name} home`}>
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <Wordmark dark={dark} className="text-xl" />
    </Link>
  );
}
