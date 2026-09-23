import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import type { CohortAvailability } from "@/lib/data";
import { cn, formatDate } from "@/lib/utils";

export function SeatsBar({ c, dark }: { c: CohortAvailability; dark?: boolean }) {
  const pct = c.capacity ? Math.min(100, Math.round((c.registered / c.capacity) * 100)) : 100;
  const low = c.seats_left > 0 && c.seats_left <= 5;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className={cn("font-bold", c.seats_left === 0 ? "text-red-500" : low ? "text-warn" : dark ? "text-gold" : "text-maroon")}>
          {c.seats_left === 0 ? "Full — waitlist open" : `${c.seats_left} of ${c.capacity} seats left`}
        </span>
        {c.waitlisted > 0 && <span className={dark ? "text-white/50" : "text-ink/50"}>{c.waitlisted} waitlisted</span>}
      </div>
      <div className={cn("mt-2 h-2 overflow-hidden rounded-full", dark ? "bg-white/10" : "bg-ink/10")}>
        <div
          className={cn("h-full rounded-full", c.seats_left === 0 ? "bg-red-500" : "bg-gradient-to-r from-maroon to-gold")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CohortDetails({ c, dark }: { c: CohortAvailability; dark?: boolean }) {
  const muted = dark ? "text-white/70" : "text-ink/70";
  return (
    <ul className={cn("space-y-2 text-sm", muted)}>
      <li className="flex items-start gap-2">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {formatDate(c.start_date)} – {formatDate(c.end_date)}
      </li>
      <li className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {c.schedule}
      </li>
      <li className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {c.location}
          {c.address && <span className="block text-xs opacity-70">{c.address}</span>}
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {c.format}
      </li>
    </ul>
  );
}
