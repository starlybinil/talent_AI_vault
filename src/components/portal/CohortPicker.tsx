"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Check, Loader2, X } from "lucide-react";
import type { CohortAvailability } from "@/lib/data";
import { submitCohortPreferences } from "@/app/portal/actions";
import { CohortDetails, SeatsBar } from "@/components/program/CohortCard";
import { Alert, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

export function CohortPicker({ applicationId, cohorts }: { applicationId: string; cohorts: CohortAvailability[] }) {
  const [ranked, setRanked] = React.useState<string[]>([]);
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionState>(null);
  const byId = Object.fromEntries(cohorts.map((c) => [c.cohort_id, c]));

  const toggle = (id: string) =>
    setRanked((r) => (r.includes(id) ? r.filter((x) => x !== id) : r.length >= 3 ? r : [...r, id]));
  const move = (i: number, d: number) =>
    setRanked((r) => {
      const n = [...r];
      const j = i + d;
      if (j < 0 || j >= n.length) return r;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <p className="text-sm text-ink/60">
          Tap cohorts to add them to your ranking (up to 3). We&apos;ll register you in the highest-ranked cohort with a seat available. If
          all three are full, you&apos;ll join their waitlists. Right after you submit, you&apos;ll sign your program agreements below.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {cohorts.map((c) => {
            const rank = ranked.indexOf(c.cohort_id);
            const selected = rank >= 0;
            return (
              <button
                type="button"
                key={c.cohort_id}
                onClick={() => toggle(c.cohort_id)}
                disabled={!selected && ranked.length >= 3}
                aria-pressed={selected}
                className={cn(
                  "relative cursor-pointer rounded-2xl border bg-white p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                  selected ? "border-maroon ring-4 ring-maroon/15" : "border-ink/10 hover:border-ink/40",
                )}
              >
                {selected && (
                  <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-gold text-sm font-black text-ink shadow">
                    #{rank + 1}
                  </span>
                )}
                <p className="text-xs font-bold uppercase tracking-widest text-maroon">{c.format}</p>
                <p className="mt-1 text-lg font-black text-ink">{c.name}</p>
                <div className="mt-3">
                  <CohortDetails c={c} />
                </div>
                <div className="mt-4">
                  <SeatsBar c={c} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl bg-ink p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-gold">Your ranking</p>
          <ol className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => {
              const c = byId[ranked[i]];
              return (
                <li key={i} className={cn("flex items-center gap-3 rounded-xl p-3", c ? "bg-white/10" : "border border-dashed border-white/20")}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-black text-ink">{i + 1}</span>
                  {c ? (
                    <>
                      <span className="flex-1 text-sm font-bold leading-tight">
                        {c.name}
                        <span className="block text-xs font-normal text-white/60">{c.seats_left > 0 ? `${c.seats_left} seats left` : "Waitlist"}</span>
                      </span>
                      <span className="flex gap-1">
                        <button type="button" className="cursor-pointer rounded p-1 hover:bg-white/10" onClick={() => move(i, -1)} aria-label="Move up">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" className="cursor-pointer rounded p-1 hover:bg-white/10" onClick={() => move(i, 1)} aria-label="Move down">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button type="button" className="cursor-pointer rounded p-1 hover:bg-white/10" onClick={() => toggle(c.cohort_id)} aria-label="Remove">
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-white/40">{i === 0 ? "Pick your first choice" : "Optional"}</span>
                  )}
                </li>
              );
            })}
          </ol>
          <Button
            className="mt-5 w-full"
            disabled={ranked.length === 0 || pending || !!result?.ok}
            onClick={() =>
              start(async () => {
                setResult(await submitCohortPreferences(applicationId, ranked));
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Submit choices &amp; continue to agreements
          </Button>
        </div>
        {result?.error && <Alert tone="danger" className="mt-3">{result.error}</Alert>}
        {result?.ok && <Alert tone="success" className="mt-3">{result.message}</Alert>}
      </aside>
    </div>
  );
}
