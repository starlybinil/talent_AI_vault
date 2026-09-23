"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, CalendarDays, FileSignature, Flag, Inbox, Layers, Mail, MapPin, PenLine, Settings, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  chart: BarChart3,
  inbox: Inbox,
  calendar: CalendarDays,
  layers: Layers,
  users: Users,
  shield: ShieldCheck,
  mail: Mail,
  settings: Settings,
  pen: PenLine,
  flag: Flag,
  activity: Activity,
  file: FileSignature,
  map: MapPin,
} as const;

export function AdminSidebar({ items }: { items: Array<{ href: string; label: string; icon: string }> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((item) => {
        const Icon = ICONS[item.icon as keyof typeof ICONS] ?? Inbox;
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition",
              active ? "bg-ink text-white" : "text-ink/60 hover:bg-white hover:text-ink",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-gold")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
