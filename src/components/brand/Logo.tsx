import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <defs>
        <linearGradient id="tv-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFC627" />
          <stop offset="1" stopColor="#E8AD00" />
        </linearGradient>
      </defs>
      <path d="M20 2 36 11v18L20 38 4 29V11z" fill="#8C1D40" />
      <path d="M20 7 31.5 13.5v13L20 33 8.5 26.5v-13z" fill="none" stroke="url(#tv-g)" strokeWidth="2.2" />
      <circle cx="20" cy="17.5" r="4" fill="url(#tv-g)" />
      <path d="M18.2 20h3.6l1.2 7h-6z" fill="url(#tv-g)" />
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
