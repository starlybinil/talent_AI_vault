"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, Search } from "lucide-react";
import { emailStudents } from "@/app/cohorts/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Input, Label, Textarea } from "@/components/ui";
import { AtRiskBadge, Pct } from "@/components/tracking/Metric";
import { cn } from "@/lib/utils";

export type RosterRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  grade: number | null;
  graded: number;
  attendance: number | null;
  present: number;
  late: number;
  absent: number;
  excused: number;
  lowGrade: boolean;
  lowAttendance: boolean;
  atRisk: boolean;
};

/** Every trainee with grade, attendance and flags; select students to email them. */
export function RosterTable({ cohortId, rows, moduleCount }: { cohortId: string; rows: RosterRow[]; moduleCount: number }) {
  const [filter, setFilter] = React.useState<"all" | "risk">("all");
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [sort, setSort] = React.useState<"name" | "grade" | "attendance">("name");

  const shown = rows
    .filter((r) => (filter === "risk" ? r.atRisk : true))
    .filter((r) => !q.trim() || `${r.name} ${r.email}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) =>
      sort === "name" ? 0 : sort === "grade" ? (a.grade ?? 101) - (b.grade ?? 101) : (a.attendance ?? 101) - (b.attendance ?? 101),
    );
  const allShownPicked = shown.length > 0 && shown.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set(p).add(id)));
  const atRisk = rows.filter((r) => r.atRisk).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full bg-white p-1 text-sm font-bold ring-1 ring-ink/10">
          {[
            ["all", `All (${rows.length})`],
            ["risk", `At risk (${atRisk})`],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k as "all" | "risk")}
              className={cn("rounded-full px-4 py-1.5", filter === k ? (k === "risk" ? "bg-red-600 text-white" : "bg-ink text-white") : "text-ink/60 hover:text-ink")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="h-10 w-56 pl-9" aria-label="Search students" />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-10 rounded-xl border border-ink/15 bg-white px-3 text-sm"
            aria-label="Sort"
          >
            <option value="name">Sort: name</option>
            <option value="grade">Sort: lowest grade</option>
            <option value="attendance">Sort: lowest attendance</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-mist text-xs uppercase tracking-wider text-ink/50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all shown"
                  checked={allShownPicked}
                  onChange={() => setPicked((p) => (allShownPicked ? new Set([...p].filter((id) => !shown.some((r) => r.id === id))) : new Set([...p, ...shown.map((r) => r.id)])))}
                  className="h-4 w-4 accent-maroon"
                />
              </th>
              <th className="px-3 py-3">Student</th>
              <th className="px-3 py-3 text-center">Grade</th>
              <th className="px-3 py-3 text-center">Attendance</th>
              <th className="px-3 py-3 text-center" title="Present · Late · Absent · Excused">P · L · A · E</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {shown.map((r) => (
              <tr key={r.id} className={r.atRisk ? "bg-red-50/60" : undefined}>
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} className="h-4 w-4 accent-maroon" />
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/cohorts/${cohortId}/students/${r.id}`} className="font-bold hover:text-maroon">
                    {r.name}
                  </Link>
                  <span className="block text-xs text-ink/50">{r.email}</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <Pct value={r.grade} kind="grade" />
                  {moduleCount > 0 && <span className="block text-[11px] text-ink/40">{r.graded}/{moduleCount} modules</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <Pct value={r.attendance} kind="attendance" />
                </td>
                <td className="px-3 py-2.5 text-center text-xs tabular-nums text-ink/60">
                  {r.present} · <span className={r.late ? "font-bold text-amber-700" : ""}>{r.late}</span> · <span className={r.absent ? "font-bold text-red-700" : ""}>{r.absent}</span> · {r.excused}
                </td>
                <td className="px-3 py-2.5">
                  {r.atRisk ? <AtRiskBadge lowGrade={r.lowGrade} lowAttendance={r.lowAttendance} /> : <span className="text-xs font-bold text-emerald-700">On track</span>}
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/50">
                  {filter === "risk" ? "Nobody is at risk right now." : "No trainees match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {picked.size > 0 && (
        <ActionForm action={emailStudents} resetOnSuccess className="grid gap-3 rounded-2xl border border-gold/60 bg-gold/5 p-4">
          <input type="hidden" name="cohort_id" value={cohortId} />
          <input type="hidden" name="audience" value="selected" />
          {[...picked].map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <p className="flex items-center gap-2 font-black">
            <Mail className="h-4 w-4 text-maroon" aria-hidden /> Email {picked.size} selected student{picked.size === 1 ? "" : "s"}
            <button type="button" onClick={() => setPicked(new Set())} className="ml-auto text-xs font-bold text-ink/50 hover:text-ink">
              Clear selection
            </button>
          </p>
          <div>
            <Label htmlFor="sel-subject">Subject</Label>
            <Input id="sel-subject" name="subject" required minLength={3} maxLength={150} placeholder="e.g. Let's talk about your attendance" />
          </div>
          <div>
            <Label htmlFor="sel-body">Message</Label>
            <Textarea id="sel-body" name="body" required minLength={3} maxLength={5000} className="min-h-28" placeholder="Each student receives their own copy." />
          </div>
          <SubmitButton size="sm" variant="dark" className="justify-self-start" pendingText="Sending…">
            Send email
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
