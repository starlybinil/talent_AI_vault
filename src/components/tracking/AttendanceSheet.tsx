"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCheck, Loader2, Save } from "lucide-react";
import { saveAttendance } from "@/app/cohorts/actions";
import { Alert, Button } from "@/components/ui";
import { ATTENDANCE_LABEL, ATTENDANCE_STATUSES, type AttendanceStatus } from "@/lib/tracking";
import { cn } from "@/lib/utils";

type Student = { id: string; name: string; attendance: number | null; lowAttendance: boolean };
export type MarkDetail = { qrTime?: string | null; flag?: string | null; reviewed?: boolean };

export const FLAG_LABEL: Record<string, string> = {
  outside_area: "Outside the training area",
  no_location: "Location unavailable",
  shared_device: "Same phone as another trainee",
};

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
  details = {},
  prefillPresent = true,
  readOnly = false,
  studentHrefPrefix,
}: {
  cohortId: string;
  sessionId: string;
  students: Student[];
  initial: Record<string, AttendanceStatus>;
  details?: Record<string, MarkDetail>;
  /** No QR check-in: unmarked students start as Present. With QR, they stay unmarked until "Mark the rest Absent". */
  prefillPresent?: boolean;
  readOnly?: boolean;
  /** Link prefix for student names (default: the cohort tracking student page); null = no links. */
  studentHrefPrefix?: string | null;
}) {
  const recorded = Object.keys(initial).length > 0;
  const base = React.useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, initial[s.id] ?? (prefillPresent && !recorded ? "present" : "")])) as Record<string, AttendanceStatus | "">,
    [students, initial, prefillPresent, recorded],
  );
  const [marks, setMarks] = React.useState<Record<string, AttendanceStatus | "">>(base);
  const [savedOnce, setSavedOnce] = React.useState(recorded);
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  React.useEffect(() => {
    setMarks(base);
    setSavedOnce(recorded);
    setResult(null);
  }, [base, recorded]);

  const counts = ATTENDANCE_STATUSES.map((st) => [st, Object.values(marks).filter((m) => m === st).length] as const);
  const unmarked = Object.values(marks).filter((m) => !m).length;

  function save() {
    startTransition(async () => {
      const res = await saveAttendance(
        cohortId,
        sessionId,
        students.flatMap((s) => (marks[s.id] ? [{ application_id: s.id, status: marks[s.id] as AttendanceStatus }] : [])),
      );
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
          {readOnly ? (
            "View only."
          ) : savedOnce ? (
            "Recorded. Change anyone and save again."
          ) : prefillPresent ? (
            <strong className="text-maroon">Not recorded yet: everyone starts as Present.</strong>
          ) : null}{" "}
          {counts.map(([st, n]) => (
            <span key={st} className="ml-2 whitespace-nowrap">
              {ATTENDANCE_LABEL[st]} <strong className="text-ink">{n}</strong>
            </span>
          ))}
          {unmarked > 0 && (
            <span className="ml-2 whitespace-nowrap">
              Not checked in <strong className="text-ink">{unmarked}</strong>
            </span>
          )}
        </p>
        <div className={cn("flex gap-2", readOnly && "hidden")}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMarks((m) => Object.fromEntries(students.map((s) => [s.id, m[s.id] || "present"])) as Record<string, AttendanceStatus | "">)}
          >
            <CheckCheck className="h-4 w-4" /> All present
          </Button>
          <Button type="button" size="sm" variant="dark" onClick={save} disabled={pending || !students.length || readOnly}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save attendance
          </Button>
        </div>
      </div>
      {result && <Alert tone={result.ok ? "success" : "danger"}>{result.text}</Alert>}
      <ul className="divide-y divide-ink/5 rounded-2xl border border-ink/10 bg-white">
        {students.map((s) => (
          <li key={s.id} className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-2", s.lowAttendance && "bg-red-50/50")}>
            <span className="min-w-0">
              {(() => {
                const href = studentHrefPrefix === null ? null : `${studentHrefPrefix ?? `/cohorts/${cohortId}/students/`}${s.id}`;
                return href ? (
                  <Link href={href} className="font-bold hover:text-maroon">
                    {s.name}
                  </Link>
                ) : (
                  <span className="font-bold">{s.name}</span>
                );
              })()}
              <span className={cn("ml-2 text-xs tabular-nums", s.lowAttendance ? "font-bold text-red-700" : "text-ink/50")}>
                {s.attendance === null ? "no attendance yet" : `${s.attendance}% overall`}
              </span>
              {details[s.id]?.qrTime && <span className="ml-2 text-xs font-bold text-emerald-700">QR {details[s.id]?.qrTime}</span>}
              {details[s.id]?.flag && (
                <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold", details[s.id]?.reviewed ? "bg-ink/5 text-ink/50" : "bg-amber-100 text-amber-900")}>
                  {details[s.id]?.reviewed ? "Reviewed: " : "⚠ "}
                  {FLAG_LABEL[details[s.id]!.flag!] ?? details[s.id]?.flag}
                </span>
              )}
            </span>
            <span role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex gap-1">
              {ATTENDANCE_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  role="radio"
                  aria-checked={marks[s.id] === st}
                  disabled={readOnly}
                  onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-bold transition",
                    marks[s.id] === st ? TONE[st] : "border-ink/10 text-ink/50 hover:border-ink/30 hover:text-ink",
                    readOnly && "cursor-default",
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
