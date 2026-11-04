"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCheck, Loader2, Save } from "lucide-react";
import { saveAttendance } from "@/app/cohorts/actions";
import { Alert, Button } from "@/components/ui";
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/tracking";
import { cn } from "@/lib/utils";

type Student = { id: string; name: string; attendance: number | null; lowAttendance: boolean };

const TONE: Record<AttendanceStatus, string> = {
  present: "border-emerald-500 bg-emerald-50 text-emerald-800",
  late: "border-amber-500 bg-amber-50 text-amber-800",
  absent: "border-red-500 bg-red-50 text-red-800",
  excused: "border-sky-500 bg-sky-50 text-sky-800",
};

/** Take attendance for one session: everyone starts as Present; tap the exceptions and save. */
export function AttendanceSheet({
  cohortId,
  sessionId,
  students,
  initial,
}: {
  cohortId: string;
  sessionId: string;
  students: Student[];
  initial: Record<string, AttendanceStatus>;
}) {
  const recorded = Object.keys(initial).length > 0;
  const base = React.useMemo(() => Object.fromEntries(students.map((s) => [s.id, initial[s.id] ?? "present"])) as Record<string, AttendanceStatus>, [students, initial]);
  const [marks, setMarks] = React.useState(base);
  const [savedOnce, setSavedOnce] = React.useState(recorded);
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  React.useEffect(() => {
    setMarks(base);
    setSavedOnce(recorded);
    setResult(null);
  }, [base, recorded]);

  const counts = ATTENDANCE_STATUSES.map((st) => [st, Object.values(marks).filter((m) => m === st).length] as const);

  function save() {
    startTransition(async () => {
      const res = await saveAttendance(cohortId, sessionId, students.map((s) => ({ application_id: s.id, status: marks[s.id] })));
      if (res?.ok) {
        setSavedOnce(true);
        setResult({ ok: true, text: res.message ?? "Saved." });
      } else setResult({ ok: false, text: res?.error ?? "Couldn't save." });
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/60">
          {savedOnce ? "Recorded. Change anyone and save again." : <strong className="text-maroon">Not recorded yet: everyone starts as Present.</strong>}{" "}
          {counts.map(([st, n]) => (
            <span key={st} className="ml-2 whitespace-nowrap">
              {ATTENDANCE_LABEL[st]} <strong className="text-ink">{n}</strong>
            </span>
          ))}
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, "present"])) as Record<string, AttendanceStatus>)}>
            <CheckCheck className="h-4 w-4" /> All present
          </Button>
          <Button type="button" size="sm" variant="dark" onClick={save} disabled={pending || !students.length}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save attendance
          </Button>
        </div>
      </div>
      {result && <Alert tone={result.ok ? "success" : "danger"}>{result.text}</Alert>}
      <ul className="divide-y divide-ink/5 rounded-2xl border border-ink/10 bg-white">
        {students.map((s) => (
          <li key={s.id} className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-2", s.lowAttendance && "bg-red-50/50")}>
            <span className="min-w-0">
              <Link href={`/cohorts/${cohortId}/students/${s.id}`} className="font-bold hover:text-maroon">
                {s.name}
              </Link>
              <span className={cn("ml-2 text-xs tabular-nums", s.lowAttendance ? "font-bold text-red-700" : "text-ink/50")}>
                {s.attendance === null ? "no attendance yet" : `${s.attendance}% overall`}
              </span>
            </span>
            <span role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex gap-1">
              {ATTENDANCE_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={marks[s.id] === st}
                  onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-bold transition",
                    marks[s.id] === st ? TONE[st] : "border-ink/10 text-ink/50 hover:border-ink/30 hover:text-ink",
                  )}
                >
                  {ATTENDANCE_LABEL[st]}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
