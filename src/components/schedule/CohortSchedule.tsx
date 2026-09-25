"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  EyeOff,
  GraduationCap,
  LayoutGrid,
  MapPin,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  cohortPhase,
  dateRange,
  defaultYear,
  durationWeeks,
  formatColors,
  isoDate,
  meetingTimes,
  meetsOn,
  packLanes,
  scheduleYears,
  shortDate,
  toUtc,
  yearOf,
  yearSpan,
  type ScheduleAudience,
  type ScheduleCohort,
} from "@/lib/schedule";

type View = "timeline" | "month" | "grid";
type Colors = Record<string, { bg: string; fg: string }>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VIEW_KEY = "tv.cohort-schedule.view";

export function CohortSchedule({
  cohorts,
  audience,
  today,
  canManage = false,
}: {
  cohorts: ScheduleCohort[];
  audience: ScheduleAudience;
  /** YYYY-MM-DD, computed on the server so the page renders the same everywhere. */
  today: string;
  /** Program admins get a link through to the cohort's management page. */
  canManage?: boolean;
}) {
  const staff = audience !== "employer";
  const [view, setView] = useState<View>("timeline");
  const [locations, setLocations] = useState<string[]>([]);
  const [format, setFormat] = useState("");
  const [program, setProgram] = useState("");
  const [showClosed, setShowClosed] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ c: ScheduleCohort; x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "timeline" || saved === "month" || saved === "grid") setView(saved);
    } catch {}
  }, []);
  const changeView = (v: View) => {
    setView(v);
    setHover(null);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const colors = useMemo(() => formatColors(cohorts.map((c) => c.format)), [cohorts]);
  const allLocations = useMemo(() => Array.from(new Set(cohorts.map((c) => c.location))).sort(), [cohorts]);
  const programs = useMemo(() => Array.from(new Map(cohorts.map((c) => [c.program_id, c.program_name])).entries()), [cohorts]);

  const filtered = useMemo(
    () =>
      cohorts.filter(
        (c) =>
          (locations.length === 0 || locations.includes(c.location)) &&
          (!format || c.format === format) &&
          (!program || c.program_id === program) &&
          (c.status !== "closed" || showClosed) &&
          (c.status !== "archived" || showArchived),
      ),
    [cohorts, locations, format, program, showClosed, showArchived],
  );

  const years = useMemo(() => {
    const ys = scheduleYears(cohorts);
    return ys.length ? ys : [yearOf(today)];
  }, [cohorts, today]);
  const [year, setYear] = useState(() => defaultYear(years, today));
  const [month, setMonth] = useState(() => {
    // Month view opens on the current month, or the first month with a cohort in the default year.
    const y = defaultYear(years, today);
    if (y === yearOf(today)) return Number(today.slice(5, 7)) - 1;
    const first = cohorts.filter((c) => yearOf(c.end_date) >= y).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    return first && yearOf(first.start_date) === y ? Number(first.start_date.slice(5, 7)) - 1 : 0;
  });
  const goMonth = (delta: number) => {
    const m = month + delta;
    setYear(year + Math.floor(m / 12));
    setMonth(((m % 12) + 12) % 12);
  };

  const selected = cohorts.find((c) => c.cohort_id === selectedId) ?? null;
  const open = useCallback((c: ScheduleCohort) => {
    setHover(null);
    setSelectedId(c.cohort_id);
  }, []);
  const hoverProps = (c: ScheduleCohort) => ({
    onMouseEnter: (e: React.MouseEvent) => setHover({ c, x: e.clientX, y: e.clientY }),
    onMouseMove: (e: React.MouseEvent) => setHover({ c, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setHover(null),
    // Keyboard users get the same details card, anchored to the focused bar.
    onFocus: (e: React.FocusEvent) => {
      const r = e.currentTarget.getBoundingClientRect();
      setHover({ c, x: r.left + r.width / 2, y: r.bottom });
    },
    onBlur: () => setHover(null),
    onClick: () => open(c),
  });

  const inYear = filtered.filter((c) => yearSpan(c, year));
  const stats = {
    cohorts: inYear.length,
    locations: new Set(inYear.map((c) => c.location)).size,
    seats: inYear.reduce((a, c) => a + c.capacity, 0),
    admitted: inYear.reduce((a, c) => a + c.registered, 0),
    confirmed: inYear.reduce((a, c) => a + c.confirmed, 0),
    waitlisted: inYear.reduce((a, c) => a + (c.waitlisted ?? 0), 0),
    graduating: filtered.filter((c) => yearOf(c.end_date) === year).reduce((a, c) => a + c.confirmed, 0),
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 border-b border-ink/10 bg-gradient-to-br from-ink to-ink-800 p-5 text-white sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (view === "month" ? goMonth(-1) : setYear(year - 1))}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 hover:border-gold hover:text-gold"
            aria-label={view === "month" ? "Previous month" : "Previous year"}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-[9.5rem] text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gold">
              {view === "month" ? "Month" : view === "grid" ? "Cohorts in" : "Year"}
            </p>
            <p className="text-2xl font-black tracking-tight" aria-live="polite">
              {view === "month" ? `${MONTHS_LONG[month]} ${year}` : year}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (view === "month" ? goMonth(1) : setYear(year + 1))}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 hover:border-gold hover:text-gold"
            aria-label={view === "month" ? "Next month" : "Next year"}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="ml-2 hidden flex-wrap gap-1.5 md:flex">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1 text-xs font-bold transition",
                  y === year ? "bg-gold text-ink" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white",
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        <div className="flex rounded-full bg-white/10 p-1" role="tablist" aria-label="Calendar view">
          {(
            [
              ["timeline", "Timeline", CalendarRange],
              ["month", "Month", CalendarDays],
              ["grid", "Grid", LayoutGrid],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => changeView(key)}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition",
                view === key ? "bg-white text-ink shadow" : "text-white/70 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Year at a glance */}
      <div className="grid grid-cols-2 gap-px border-b border-ink/10 bg-ink/10 sm:grid-cols-3 lg:grid-cols-6">
        <Glance label={`Cohorts in ${year}`} value={stats.cohorts} />
        <Glance label="Locations" value={stats.locations} />
        <Glance label="Total seats" value={stats.seats} />
        <Glance label="Admitted" value={stats.admitted} hint={stats.seats ? `${Math.round((stats.admitted / stats.seats) * 100)}% full` : undefined} />
        <Glance label="Confirmed" value={stats.confirmed} />
        {staff ? (
          <Glance label="Waitlisted" value={stats.waitlisted} />
        ) : (
          <Glance label={`Graduating in ${year}`} value={stats.graduating} hint="confirmed trainees" />
        )}
      </div>

      {/* Filters + legend */}
      <div className="flex flex-col gap-3 border-b border-ink/10 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold uppercase tracking-widest text-ink/50">Location</span>
          <Chip active={locations.length === 0} onClick={() => setLocations([])}>
            All
          </Chip>
          {allLocations.map((l) => (
            <Chip
              key={l}
              active={locations.includes(l)}
              onClick={() => setLocations(locations.includes(l) ? locations.filter((x) => x !== l) : [...locations, l])}
            >
              <MapPin className="h-3 w-3" aria-hidden /> {l}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {programs.length > 1 && (
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="h-9 rounded-full border border-ink/15 bg-white px-3 text-sm font-bold"
              aria-label="Program"
            >
              <option value="">All programs</option>
              {programs.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          {staff && (
            <>
              <label className="flex cursor-pointer items-center gap-1.5 text-sm font-bold text-ink/70">
                <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="h-4 w-4 accent-maroon" /> Closed
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-sm font-bold text-ink/70">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-maroon" /> Archived
              </label>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-mist/60 px-5 py-3 sm:px-6">
        <span className="mr-1 text-xs font-bold uppercase tracking-widest text-ink/50">Format</span>
        {Object.entries(colors).map(([f, col]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(format === f ? "" : f)}
            aria-pressed={format === f}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold transition",
              format === f ? "border-ink bg-white shadow-sm" : "border-transparent hover:bg-white",
              format && format !== f && "opacity-50",
            )}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: col.bg }} aria-hidden />
            {f}
          </button>
        ))}
        {cohorts.some((c) => c.visible_to_applicants === false) && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-ink/60">
            <span className="inline-block h-3 w-5 rounded bg-maroon outline-dashed outline-2 -outline-offset-2 outline-white" aria-hidden />
            Hidden from applicants
          </span>
        )}
        <span className="ml-auto hidden text-xs text-ink/50 sm:inline">Hover for a preview · click a cohort for details</span>
      </div>

      <div className="p-5 sm:p-6">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 bg-mist px-6 py-12 text-center font-bold text-ink/60">No cohorts match these filters.</p>
        ) : view === "timeline" ? (
          <Timeline cohorts={filtered} year={year} today={today} colors={colors} hoverProps={hoverProps} selectedId={selectedId} />
        ) : view === "month" ? (
          <MonthView cohorts={filtered} year={year} month={month} today={today} colors={colors} hoverProps={hoverProps} onOpen={open} />
        ) : (
          <GridView cohorts={filtered} year={year} today={today} colors={colors} staff={staff} onOpen={open} />
        )}
      </div>

      {hover && !selected && <HoverCard c={hover.c} x={hover.x} y={hover.y} colors={colors} staff={staff} today={today} />}
      {selected && <DetailPanel c={selected} colors={colors} audience={audience} canManage={canManage} today={today} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function Glance({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-ink">{value.toLocaleString()}</p>
      {hint && <p className="text-xs text-ink/50">{hint}</p>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold transition",
        active ? "border-maroon bg-maroon text-white" : "border-ink/15 bg-white text-ink/70 hover:border-maroon hover:text-maroon",
      )}
    >
      {children}
    </button>
  );
}

type HoverProps = (c: ScheduleCohort) => {
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onFocus: (e: React.FocusEvent) => void;
  onBlur: () => void;
  onClick: () => void;
};

function fillPct(c: ScheduleCohort) {
  return c.capacity ? Math.min(100, Math.round((c.registered / c.capacity) * 100)) : 0;
}

/* ------------------------------------------------------------------ Timeline */

function Timeline({
  cohorts,
  year,
  today,
  colors,
  hoverProps,
  selectedId,
}: {
  cohorts: ScheduleCohort[];
  year: number;
  today: string;
  colors: Colors;
  hoverProps: HoverProps;
  selectedId: string | null;
}) {
  const visible = cohorts.filter((c) => yearSpan(c, year));
  const byLocation = Array.from(
    visible.reduce((m, c) => m.set(c.location, [...(m.get(c.location) ?? []), c]), new Map<string, ScheduleCohort[]>()).entries(),
  ).sort((a, b) => a[0].localeCompare(b[0]));
  const todayPos = yearOf(today) === year ? yearSpan({ start_date: today, end_date: today }, year)?.left : undefined;
  const monthStarts = MONTHS.map((_, i) => (Date.UTC(year, i, 1) - Date.UTC(year, 0, 1)) / (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)));

  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-ink/15 bg-mist px-6 py-12 text-center font-bold text-ink/60">
        No cohorts run in {year}. Use the arrows to see other years.
      </p>
    );
  }

  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      <div className="min-w-[880px]">
        {/* Month header */}
        <div className="flex">
          <div className="w-44 shrink-0" />
          <div className="relative h-8 flex-1">
            {MONTHS.map((m, i) => (
              <span
                key={m}
                className="absolute top-0 pl-2 text-xs font-bold uppercase tracking-widest text-ink/50"
                style={{ left: `${monthStarts[i] * 100}%` }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-ink/10">
          {byLocation.map(([location, items], li) => {
            // Bars carry no text (details show on hover), so only leave room for the minimum bar width.
            const lanes = packLanes(items, 14);
            const address = items[0].address;
            return (
              <div key={location} className={cn("flex", li > 0 && "border-t border-ink/10")}>
                <div className="w-44 shrink-0 border-r border-ink/10 bg-mist/70 px-4 py-3">
                  <p className="flex items-center gap-1.5 font-black text-ink">
                    <MapPin className="h-4 w-4 shrink-0 text-maroon" aria-hidden /> {location}
                  </p>
                  {address && <p className="mt-0.5 line-clamp-2 text-xs text-ink/50">{address}</p>}
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-ink/40">
                    {items.length} cohort{items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="relative flex-1 py-2">
                  {/* month grid + quarter shading */}
                  {monthStarts.map((s, i) => (
                    <div
                      key={i}
                      className={cn("absolute inset-y-0 border-l border-ink/5", Math.floor(i / 3) % 2 === 1 && "bg-mist/50")}
                      style={{ left: `${s * 100}%`, width: `${((monthStarts[i + 1] ?? 1) - s) * 100}%` }}
                      aria-hidden
                    />
                  ))}
                  {todayPos !== undefined && <div className="absolute inset-y-0 z-10 w-0.5 bg-maroon/70" style={{ left: `${todayPos * 100}%` }} aria-hidden />}
                  {lanes.map((lane, i) => (
                    <div key={i} className="relative h-12">
                      {lane.map((c) => {
                        const span = yearSpan(c, year)!;
                        const col = colors[c.format];
                        const pct = fillPct(c);
                        return (
                          <div key={c.cohort_id} className="contents">
                            <button
                              type="button"
                              {...hoverProps(c)}
                              aria-label={`${c.name}, ${c.location}, ${dateRange(c)}, ${c.registered} of ${c.capacity} admitted${c.visible_to_applicants === false ? ", hidden from applicants" : ""}`}
                              className={cn(
                                "group absolute top-1.5 z-20 flex h-9 cursor-pointer items-center justify-center overflow-hidden px-1 shadow-sm ring-offset-2 transition hover:z-30 hover:-translate-y-0.5 hover:shadow-lg focus-visible:z-30",
                                span.clippedStart ? "rounded-l-sm" : "rounded-l-xl",
                                span.clippedEnd ? "rounded-r-sm" : "rounded-r-xl",
                                c.status === "closed" && "opacity-60",
                                c.visible_to_applicants === false && "outline-dashed outline-2 -outline-offset-4 outline-white/80",
                                c.status === "archived" && "opacity-40 grayscale",
                                selectedId === c.cohort_id && "ring-2 ring-ink",
                              )}
                              style={{ left: `${span.left * 100}%`, width: `max(${span.width * 100}%, 1.75rem)`, background: col.bg, color: col.fg }}
                            >
                              {/* Enrollment only (admitted / seats); everything else is in the hover card. */}
                              <span className="whitespace-nowrap pb-0.5 text-xs font-black tabular-nums leading-none" aria-hidden>
                                {c.registered}/{c.capacity}
                              </span>
                              <span className="absolute inset-x-0 bottom-0 h-1 bg-black/15" aria-hidden>
                                <span className="block h-full bg-white/80" style={{ width: `${pct}%` }} />
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {todayPos !== undefined && (
          <p className="mt-2 flex items-center gap-2 text-xs text-ink/50">
            <span className="inline-block h-3 w-0.5 bg-maroon/70" aria-hidden /> Today · {shortDate(today)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Month */

function MonthView({
  cohorts,
  year,
  month,
  today,
  colors,
  hoverProps,
  onOpen,
}: {
  cohorts: ScheduleCohort[];
  year: number;
  month: number;
  today: string;
  colors: Colors;
  hoverProps: HoverProps;
  onOpen: (c: ScheduleCohort) => void;
}) {
  const first = Date.UTC(year, month, 1);
  const startOffset = new Date(first).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - startOffset + 1;
    return day >= 1 && day <= daysInMonth ? isoDate(Date.UTC(year, month, day)) : null;
  });
  const inMonth = cohorts.filter((c) => c.start_date <= isoDate(Date.UTC(year, month, daysInMonth)) && c.end_date >= isoDate(first));
  const [picked, setPicked] = useState<string | null>(null);
  const pickedDay = picked && picked.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`) ? picked : null;
  const dayList = pickedDay ? inMonth.filter((c) => meetsOn(c, pickedDay) || c.start_date === pickedDay || c.end_date === pickedDay) : [];

  return (
    <div>
      <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-ink/10">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b border-ink/10 bg-mist px-2 py-2 text-center text-[11px] font-bold uppercase tracking-widest text-ink/50">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-16 border-b border-r border-ink/5 bg-mist/40 sm:min-h-28" />;
          const meeting = inMonth.filter((c) => meetsOn(c, date));
          const starts = inMonth.filter((c) => c.start_date === date);
          const ends = inMonth.filter((c) => c.end_date === date);
          const isToday = date === today;
          return (
            <div key={date} className={cn("min-h-16 border-b border-r border-ink/5 p-1 sm:min-h-28 sm:p-1.5", pickedDay === date && "bg-gold/10")}>
              <button
                type="button"
                onClick={() => setPicked(date)}
                className={cn(
                  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-xs font-black",
                  isToday ? "bg-maroon text-white" : "text-ink/70 hover:bg-mist",
                )}
                aria-label={`${shortDate(date)}: ${meeting.length} cohort(s) in session`}
              >
                {Number(date.slice(8))}
              </button>
              {/* phone: dots */}
              <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                {meeting.slice(0, 6).map((c) => (
                  <span key={c.cohort_id} className="h-1.5 w-1.5 rounded-full" style={{ background: colors[c.format].bg }} />
                ))}
              </div>
              {/* tablet/desktop: chips */}
              <div className="mt-1 hidden space-y-1 sm:block">
                {starts.map((c) => (
                  <p key={`s-${c.cohort_id}`} className="truncate text-[10px] font-black uppercase tracking-wide text-success">
                    ▶ {c.location} starts
                  </p>
                ))}
                {ends.map((c) => (
                  <p key={`e-${c.cohort_id}`} className="truncate text-[10px] font-black uppercase tracking-wide text-maroon">
                    🎓 {c.location} graduates
                  </p>
                ))}
                {meeting.slice(0, 3).map((c) => {
                  const col = colors[c.format];
                  return (
                    <button
                      key={c.cohort_id}
                      type="button"
                      {...hoverProps(c)}
                      className={cn(
                        "block w-full cursor-pointer truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-bold transition hover:brightness-110",
                        c.status !== "open" && "opacity-60",
                      )}
                      style={{ background: col.bg, color: col.fg }}
                    >
                      {c.location}
                      <span className="opacity-75"> · {meetingTimes(c.schedule)?.split(/[–-]/)[0].trim() ?? c.format}</span>
                    </button>
                  );
                })}
                {meeting.length > 3 && (
                  <button type="button" onClick={() => setPicked(date)} className="cursor-pointer text-[11px] font-bold text-maroon hover:underline">
                    +{meeting.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl bg-mist p-4 sm:p-5">
        {pickedDay ? (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-ink/50">
              {new Date(toUtc(pickedDay)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
            </p>
            {dayList.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">No classes this day.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {dayList.map((c) => (
                  <li key={c.cohort_id}>
                    <CohortRow
                      c={c}
                      colors={colors}
                      onOpen={onOpen}
                      note={c.start_date === pickedDay ? "First day" : c.end_date === pickedDay ? "Graduation day" : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-ink/50">
              {inMonth.length} cohort{inMonth.length === 1 ? "" : "s"} in session in {MONTHS_LONG[month]} · pick a day to see who meets
            </p>
            {inMonth.length > 0 && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {inMonth.map((c) => (
                  <li key={c.cohort_id}>
                    <CohortRow c={c} colors={colors} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CohortRow({ c, colors, onOpen, note }: { c: ScheduleCohort; colors: Colors; onOpen: (c: ScheduleCohort) => void; note?: string }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(c)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition hover:shadow-md"
    >
      <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: colors[c.format].bg }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-ink">{c.name}</span>
        <span className="block truncate text-xs text-ink/60">
          {c.location} · {c.schedule}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs">
        {note && <span className="block font-black text-maroon">{note}</span>}
        <span className="font-bold text-ink/70">
          {c.registered}/{c.capacity}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ Grid */

function GridView({
  cohorts,
  year,
  today,
  colors,
  staff,
  onOpen,
}: {
  cohorts: ScheduleCohort[];
  year: number;
  today: string;
  colors: Colors;
  staff: boolean;
  onOpen: (c: ScheduleCohort) => void;
}) {
  const visible = cohorts.filter((c) => yearSpan(c, year));
  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-ink/15 bg-mist px-6 py-12 text-center font-bold text-ink/60">
        No cohorts run in {year}. Use the arrows to see other years.
      </p>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((c) => {
        const col = colors[c.format];
        const pct = fillPct(c);
        const phase = cohortPhase(c, today);
        return (
          <button
            key={c.cohort_id}
            type="button"
            onClick={() => onOpen(c)}
            className={cn(
              "group cursor-pointer overflow-hidden rounded-2xl border border-ink/10 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-maroon hover:shadow-lg",
              c.status === "archived" && "opacity-60",
            )}
          >
            <div className="h-1.5" style={{ background: col.bg }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: col.bg === "#FFC627" ? "#8C1D40" : col.bg }}>
                    {c.format}
                  </p>
                  <p className="mt-1 text-lg font-black text-ink">{c.name}</p>
                </div>
                <PhaseBadge phase={phase.key} status={staff ? c.status : undefined} />
              </div>
              {c.visible_to_applicants === false && <HiddenNote className="mt-2 text-maroon" />}
              <p className="mt-3 flex items-center gap-1.5 text-sm text-ink/70">
                <CalendarDays className="h-4 w-4 text-ink/40" aria-hidden /> {dateRange(c)} · {durationWeeks(c)} wks
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/70">
                <Clock className="h-4 w-4 text-ink/40" aria-hidden /> {c.schedule}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/70">
                <MapPin className="h-4 w-4 text-ink/40" aria-hidden /> {c.location}
              </p>
              <div className="mt-4">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-ink">
                    {c.registered} of {c.capacity} admitted
                  </span>
                  <span className="text-ink/50">{staff && c.waitlisted ? `${c.waitlisted} waitlisted` : `${c.confirmed} confirmed`}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-smoke">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col.bg }} />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PhaseBadge({ phase, status }: { phase: "upcoming" | "running" | "completed"; status?: string }) {
  if (status && status !== "open") {
    return <span className="shrink-0 rounded-full bg-smoke px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink/60">{status}</span>;
  }
  const style = {
    upcoming: "bg-sky-50 text-sky-800",
    running: "bg-emerald-50 text-emerald-800",
    completed: "bg-smoke text-ink/60",
  }[phase];
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", style)}>
      {phase === "running" ? "In session" : phase}
    </span>
  );
}

/* ------------------------------------------------------------------ Hover + detail */

function HoverCard({ c, x, y, colors, staff, today }: { c: ScheduleCohort; x: number; y: number; colors: Colors; staff: boolean; today: string }) {
  const [size, setSize] = useState({ w: 1280, h: 800 });
  useEffect(() => setSize({ w: window.innerWidth, h: window.innerHeight }), []);
  const width = 288;
  const left = Math.min(x + 16, size.w - width - 12);
  const top = y + 200 > size.h ? y - 190 : y + 16;
  return (
    <div
      className="pointer-events-none fixed z-[90] overflow-hidden rounded-2xl bg-ink text-white shadow-2xl ring-1 ring-white/10"
      style={{ left, top, width }}
      role="tooltip"
    >
      <div className="h-1" style={{ background: colors[c.format].bg }} />
      <div className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gold">{c.format}</p>
        <p className="mt-0.5 font-black">{c.name}</p>
        <p className="mt-2 text-xs text-white/70">{dateRange(c)}</p>
        <p className="text-xs text-white/70">{c.schedule}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-white/70">
          <MapPin className="h-3 w-3" aria-hidden /> {c.location}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini label="Admitted" value={`${c.registered}/${c.capacity}`} />
          {c.completed > 0 ? <Mini label="Graduates" value={c.completed} /> : <Mini label="Confirmed" value={c.confirmed} />}
          {staff ? <Mini label="Waitlist" value={c.waitlisted ?? 0} /> : <Mini label="Weeks" value={durationWeeks(c)} />}
        </div>
        {c.visible_to_applicants === false && <HiddenNote className="mt-3 text-gold" />}
        <p className="mt-3 text-[11px] font-bold text-white/50">{cohortPhase(c, today).label} · click for details</p>
      </div>
    </div>
  );
}

function HiddenNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-xs font-bold", className)}>
      <EyeOff className="h-3.5 w-3.5" aria-hidden /> Hidden from applicants
    </p>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-1.5">
      <p className="text-sm font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</p>
    </div>
  );
}

function DetailPanel({
  c,
  colors,
  audience,
  canManage,
  today,
  onClose,
}: {
  c: ScheduleCohort;
  colors: Colors;
  audience: ScheduleAudience;
  canManage: boolean;
  today: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const col = colors[c.format];
  const staff = audience !== "employer";
  const pct = fillPct(c);
  const phase = cohortPhase(c, today);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address || c.location)}`;
  const inAgreements = Math.max(c.registered - c.confirmed, 0);

  return (
    <div className="fixed inset-0 z-[95] flex justify-end" role="presentation">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cohort-detail-title"
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
      >
        <div className="relative p-6 pb-8 sm:p-7" style={{ background: col.bg, color: col.fg }}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/15 hover:bg-black/25"
            aria-label="Close"
            autoFocus
          >
            <X className="h-5 w-5" />
          </button>
          <p className="pr-10 text-xs font-bold uppercase tracking-[0.2em] opacity-80">
            {c.program_name} · {c.format}
          </p>
          <h2 id="cohort-detail-title" className="mt-2 pr-10 text-2xl font-black leading-tight">
            {c.name}
          </h2>
          <p className="mt-3 inline-flex rounded-full bg-black/15 px-3 py-1 text-xs font-bold">
            {phase.label}
            {staff && c.status !== "open" ? ` · ${c.status}` : ""}
            {c.visible_to_applicants === false ? " · hidden from applicants" : ""}
          </p>
        </div>

        <div className="grid gap-5 p-6 sm:p-7">
          {/* Enrollment */}
          <section className="rounded-2xl border border-ink/10 p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink/50">Admitted</p>
                <p className="text-3xl font-black tabular-nums text-ink">
                  {c.registered}
                  <span className="text-lg text-ink/40"> / {c.capacity}</span>
                </p>
              </div>
              <p className="text-sm font-black text-ink/70">{pct}% full</p>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-smoke">
              <div className="h-full bg-success" style={{ width: `${c.capacity ? (c.confirmed / c.capacity) * 100 : 0}%` }} title="Confirmed" />
              <div
                className="h-full bg-gold"
                style={{ width: `${c.capacity ? (inAgreements / c.capacity) * 100 : 0}%` }}
                title="Admitted, finishing paperwork"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-ink/60">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-success" /> {c.confirmed} confirmed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-gold" /> {inAgreements} finishing paperwork
              </span>
              {staff && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-smoke ring-1 ring-ink/20" /> {c.seats_left ?? 0} seats left
                </span>
              )}
            </div>
            {staff && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Fact label="Waitlisted" value={c.waitlisted ?? 0} />
                <Fact label="Seats left" value={c.seats_left ?? 0} />
              </div>
            )}
          </section>

          {c.completed > 0 && (
            <section className="rounded-2xl border border-success/30 bg-emerald-50/60 p-5">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-success">
                <GraduationCap className="h-4 w-4" aria-hidden /> Outcomes
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Fact label="Graduates" value={c.completed} />
                <Fact label="Hired" value={c.hired} />
                <Fact label="Placement" value={`${Math.round((c.hired / c.completed) * 100)}%`} />
              </div>
            </section>
          )}

          {/* When */}
          <section className="grid gap-3">
            <Detail icon={CalendarDays} label="Dates">
              {dateRange(c)} · {durationWeeks(c)} weeks
            </Detail>
            <Detail icon={Clock} label="Days & times">
              {c.schedule}
            </Detail>
            <Detail icon={MapPin} label="Location">
              <span className="block">{c.location}</span>
              {c.address && <span className="block text-ink/60">{c.address}</span>}
              <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-maroon hover:underline">
                Open in Maps <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </Detail>
          </section>

          {audience === "employer" && (
            <section className="rounded-2xl bg-gradient-to-br from-maroon to-maroon-900 p-5 text-white">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold">
                <GraduationCap className="h-4 w-4" aria-hidden /> Talent available
              </p>
              <p className="mt-2 text-lg font-black">
                {c.completed > 0
                  ? `${c.completed - c.hired} graduate${c.completed - c.hired === 1 ? "" : "s"} available to hire · ${c.hired} hired`
                  : `${c.confirmed} confirmed trainee${c.confirmed === 1 ? "" : "s"} graduate ${shortDate(c.end_date)}`}
              </p>
              <p className="mt-1 text-sm text-white/70">
                Graduates are interview-ready upon successful completion of the program&apos;s milestones.
              </p>
            </section>
          )}

          <div className="flex flex-col gap-2">
            {canManage && (
              <Link
                href={`/admin/cohorts/${c.cohort_id}`}
                className="flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-ink-800"
              >
                <Users className="h-4 w-4" aria-hidden /> Roster, waitlist &amp; edit cohort <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
            {audience === "employer" && (
              <Link
                href="/employer/candidates"
                className="flex h-11 items-center justify-center gap-2 rounded-full bg-gold px-5 text-sm font-bold text-ink hover:bg-gold-600"
              >
                View candidates <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
            {audience === "it" && <p className="text-center text-xs text-ink/50">Read-only view. Program admins manage cohorts.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-mist px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{label}</p>
      <p className="text-lg font-black tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-maroon">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="text-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-ink/50">{label}</p>
        <div className="font-bold text-ink">{children}</div>
      </div>
    </div>
  );
}
