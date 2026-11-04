"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { saveGrades } from "@/app/cohorts/actions";
import { Alert, Button } from "@/components/ui";
import { GRADE_MIN, parseScore } from "@/lib/tracking";
import { cn } from "@/lib/utils";

type Student = { id: string; name: string };
type Mod = { id: string; name: string };

/** Spreadsheet-style grade entry: one score (0–100) per student per module. Enter moves down, Tab moves right. */
export function GradesGrid({
  cohortId,
  students,
  modules,
  initial,
}: {
  cohortId: string;
  students: Student[];
  modules: Mod[];
  initial: Record<string, number>;
}) {
  const key = (m: string, a: string) => `${m}:${a}`;
  const start = React.useMemo(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])), [initial]);
  const [values, setValues] = React.useState<Record<string, string>>(start);
  const [saved, setSaved] = React.useState<Record<string, string>>(start);
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);

  const dirty = Object.keys({ ...values, ...saved }).filter((k) => (values[k] ?? "") !== (saved[k] ?? ""));
  const invalid = new Set(Object.entries(values).filter(([, v]) => parseScore(v) === "invalid").map(([k]) => k));

  // Warn before leaving with unsaved scores.
  React.useEffect(() => {
    if (!dirty.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty.length]);

  const rowAvg = (a: string) => {
    const xs = modules.map((m) => parseScore(values[key(m.id, a)] ?? "")).filter((v): v is number => typeof v === "number");
    return xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null;
  };
  const colAvg = (m: string) => {
    const xs = students.map((s) => parseScore(values[key(m, s.id)] ?? "")).filter((v): v is number => typeof v === "number");
    return xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null;
  };

  function save() {
    if (invalid.size) {
      setResult({ ok: false, text: "Some cells aren't valid scores (use 0–100). They're outlined in red." });
      return;
    }
    const cells = dirty.map((k) => {
      const [module_id, application_id] = k.split(":");
      return { module_id, application_id, raw: values[k] ?? "" };
    });
    startTransition(async () => {
      const res = await saveGrades(cohortId, cells);
      if (res?.ok) {
        setSaved({ ...values });
        setResult({ ok: true, text: res.message ?? "Saved." });
      } else setResult({ ok: false, text: res?.error ?? "Couldn't save." });
    });
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = document.getElementById(`g-${row + (e.key === "ArrowUp" ? -1 : 1)}-${col}`) as HTMLInputElement | null;
      next?.focus();
      next?.select();
    }
  }

  if (!modules.length) return <p className="rounded-2xl bg-white p-6 text-sm text-ink/60">Set up the cohort&apos;s modules on the Modules tab to start entering grades.</p>;

  return (
    <div className="grid gap-3">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/95 px-4 py-3 backdrop-blur">
        <p className="text-sm text-ink/60">
          {dirty.length ? <strong className="text-maroon">{dirty.length} unsaved change{dirty.length === 1 ? "" : "s"}</strong> : "All changes saved."}{" "}
          <span className="hidden sm:inline">Enter a score from 0 to 100; leave blank if not graded yet. Enter moves down.</span>
        </p>
        <Button type="button" size="sm" variant="dark" onClick={save} disabled={pending || !dirty.length}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save grades
        </Button>
      </div>
      {result && <Alert tone={result.ok ? "success" : "danger"}>{result.text}</Alert>}
      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink/50">
            <tr>
              <th className="sticky left-0 top-0 z-10 min-w-48 border-b border-ink/10 bg-mist px-3 py-2 text-left">Student</th>
              {modules.map((m) => (
                <th key={m.id} className="sticky top-0 min-w-24 border-b border-ink/10 bg-mist px-2 py-2 text-center normal-case tracking-normal" title={m.name}>
                  <span className="line-clamp-2 font-bold text-ink/70">{m.name}</span>
                </th>
              ))}
              <th className="sticky top-0 min-w-20 border-b border-ink/10 bg-mist px-2 py-2 text-center">Average</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, row) => {
              const avg = rowAvg(s.id);
              const low = avg !== null && avg < GRADE_MIN;
              return (
                <tr key={s.id} className={low ? "bg-red-50/60" : undefined}>
                  <td className={cn("sticky left-0 z-[1] border-b border-ink/5 px-3 py-1.5 font-bold", low ? "bg-red-50" : "bg-white")}>
                    <Link href={`/cohorts/${cohortId}/students/${s.id}`} className="hover:text-maroon">
                      {s.name}
                    </Link>
                  </td>
                  {modules.map((m, col) => {
                    const k = key(m.id, s.id);
                    const v = values[k] ?? "";
                    const n = parseScore(v);
                    return (
                      <td key={m.id} className="border-b border-ink/5 px-1 py-1 text-center">
                        <input
                          id={`g-${row}-${col}`}
                          inputMode="decimal"
                          aria-label={`${s.name}, ${m.name}`}
                          value={v}
                          onChange={(e) => setValues((x) => ({ ...x, [k]: e.target.value }))}
                          onKeyDown={(e) => onKey(e, row, col)}
                          onFocus={(e) => e.currentTarget.select()}
                          className={cn(
                            "h-9 w-16 rounded-lg border text-center tabular-nums outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20",
                            invalid.has(k) ? "border-red-500 bg-red-50" : typeof n === "number" && n < GRADE_MIN ? "border-red-200 bg-red-50 font-bold text-red-800" : "border-ink/10",
                            (values[k] ?? "") !== (saved[k] ?? "") && "ring-2 ring-gold/60",
                          )}
                        />
                      </td>
                    );
                  })}
                  <td className={cn("border-b border-ink/5 px-2 text-center font-black tabular-nums", low ? "text-red-700" : "text-ink")}>{avg === null ? "—" : `${avg}%`}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="text-xs font-bold text-ink/60">
              <td className="sticky left-0 bg-mist px-3 py-2">Cohort average</td>
              {modules.map((m) => {
                const a = colAvg(m.id);
                return (
                  <td key={m.id} className={cn("bg-mist px-2 py-2 text-center tabular-nums", a !== null && a < GRADE_MIN && "text-red-700")}>
                    {a === null ? "—" : `${a}%`}
                  </td>
                );
              })}
              <td className="bg-mist" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
