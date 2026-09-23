import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <path d="M20 2 36 11v18L20 38 4 29V11z" fill="#8C1D40" />
      <path d="M20 7 31.5 13.5v13L20 33 8.5 26.5v-13z" fill="none" stroke="#FFC627" strokeWidth="2.2" />
      <circle cx="20" cy="17.5" r="4" fill="#FFC627" />
      <path d="M18.2 20h3.6l1.2 7h-6z" fill="#FFC627" />
    </svg>
  );
}

export function Logo({ dark = false, className, href = "/" }: { dark?: boolean; className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Talent-Vault home">
      <LogoMark className="transition-transform duration-300 group-hover:rotate-[30deg]" />
      <span className={cn("text-xl font-black tracking-tight", dark ? "text-white" : "text-ink")}>
        Talent<span className="text-gold">-</span>Vault
      </span>
    </Link>
  );
}
