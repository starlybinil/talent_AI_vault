"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft, RotateCcw, Timer, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { savePracticeAttempt } from "@/app/portal/actions";
import { questionScore, summarize, type QuizQuestion, type Visual } from "@/lib/quiz";
import { ToolArt } from "@/components/practice/ToolArt";
import { TOOL_BY_ID } from "@/lib/practice-tools";

type Activity = "cognitive" | "tools" | "judgement";
const LETTERS = ["A", "B", "C", "D", "E"];

export type QuizRunnerProps = {
  activity: Activity;
  /** Built fresh on every start. */
  build: () => QuizQuestion[];
  intro: React.ReactNode;
  personalBest: number | null;
  suggestedMinutes: number;
  level: (pct: number) => { label: string; note: string };
  accent?: "maroon" | "ink";
  /** Situational judgement: every option earns some credit, so say "best answer" instead of "correct". */
  weighted?: boolean;
};

export function QuizRunner({ activity, build, intro, personalBest, suggestedMinutes, level, accent = "maroon", weighted = false }: QuizRunnerProps) {
  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [choices, setChoices] = useState<Array<number | null>>([]);
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [saved, setSaved] = useState<{ previousBest: number | null } | null>(null);
  const [onlyMissed, setOnlyMissed] = useState(false);

  const start = () => {
    const qs = build();
    const t = Date.now();
    setQuestions(qs);
    setChoices(qs.map(() => null));
    setIndex(0);
    setStartedAt(t);
    setNow(t);
    setSaved(null);
    setOnlyMissed(false);
    setPhase("running");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase]);

  const finish = useCallback(() => {
    const secs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const s = summarize(questions, choices);
    setSeconds(secs);
    setPhase("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
    const details: Record<string, number | string | boolean | string[]> = {
      correct: s.correct,
      total: s.total,
      seen: Array.from(new Set(questions.map((q) => q.id))),
    };
    for (const b of s.bySection) details[`section:${b.section}`] = b.pct;
    savePracticeAttempt({ activity, score: s.pct, accuracy: s.pct, durationSeconds: Math.min(secs, 3600), details }).then((res) =>
      setSaved(res.ok ? { previousBest: res.previousBest ?? null } : null),
    );
  }, [activity, questions, choices, startedAt]);

  const choose = useCallback(
    (i: number) => {
      setChoices((c) => {
        const next = [...c];
        next[index] = i;
        return next;
      });
    },
    [index],
  );

  const goNext = useCallback(() => {
    if (choices[index] === null || choices[index] === undefined) return;
    if (index + 1 >= questions.length) finish();
    else setIndex(index + 1);
  }, [choices, index, questions.length, finish]);

  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const q = questions[index];
      if (!q) return;
      const k = e.key.toUpperCase();
      const n = /^[1-9]$/.test(k) ? Number(k) - 1 : LETTERS.indexOf(k);
      if (n >= 0 && n < q.options.length) {
        e.preventDefault();
        choose(n);
      } else if (e.key === "Enter") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, questions, index, choose, goNext]);

  const headerBg = accent === "ink" ? "from-ink to-ink-800" : "from-maroon to-maroon-900";

  if (phase === "intro") {
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
        {intro}
        <div className="flex flex-wrap items-center gap-4 border-t border-ink/10 p-6 sm:px-8">
          <Button size="lg" onClick={start}>
            Start <ArrowRight className="h-5 w-5" aria-hidden />
          </Button>
          <p className="text-sm text-ink/60">About {suggestedMinutes} minutes · new questions every attempt</p>
          {personalBest !== null && <p className="ml-auto text-sm font-bold text-ink/70">Your best: {Math.round(personalBest)}%</p>}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const s = summarize(questions, choices);
    const lv = level(s.pct);
    const newBest = saved && (saved.previousBest === null || s.pct > saved.previousBest);
    const review = questions.map((q, i) => ({ q, i, choice: choices[i], credit: questionScore(q, choices[i] ?? null) }));
    const shown = onlyMissed ? review.filter((r) => r.credit < 1) : review;
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
        <div className={cn("bg-gradient-to-br p-6 text-white sm:p-8", headerBg)}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Result · {lv.label}</p>
          <p className="mt-2 flex flex-wrap items-end gap-3">
            <span className="text-6xl font-black tabular-nums tracking-tight">{Math.round(s.pct)}%</span>
            <span className="mb-2 text-lg font-bold text-white/70">
              {weighted ? `${s.correct} of ${s.total} best answers` : `${s.correct} of ${s.total} correct`} · {formatTime(seconds)}
            </span>
          </p>
          <p className="mt-1 max-w-2xl text-white/75">{lv.note}</p>
          {newBest && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1 text-sm font-black text-ink">
              <Trophy className="h-4 w-4" aria-hidden /> New personal best!
            </p>
          )}
        </div>

        {s.bySection.length > 1 && (
          <div className="grid gap-4 border-b border-ink/10 p-6 sm:grid-cols-3 sm:px-8">
            {s.bySection.map((b) => (
              <div key={b.section}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-bold">{b.section}</span>
                  <span className="font-black tabular-nums">{b.pct}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-smoke">
                  <div className={cn("h-full rounded-full", b.pct >= 80 ? "bg-success" : b.pct >= 60 ? "bg-gold" : "bg-maroon")} style={{ width: `${b.pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink/50">{b.total} questions</p>
              </div>
            ))}
          </div>
        )}

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-black">Review your answers</p>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink/70">
              <input type="checkbox" checked={onlyMissed} onChange={(e) => setOnlyMissed(e.target.checked)} className="h-4 w-4 accent-maroon" />
              Only show ones to improve
            </label>
          </div>
          {shown.length === 0 && <p className="mt-4 font-bold text-success">Nothing to improve. Every answer was the best one.</p>}
          <ol className="mt-4 grid gap-4">
            {shown.map(({ q, i, choice, credit }) => (
              <li key={i} className="rounded-2xl border border-ink/10 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-ink/50">
                    {i + 1}. {q.section}
                  </p>
                  <span
                    className={cn(
                      "flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-black",
                      credit === 1 ? "bg-emerald-50 text-success" : credit > 0 ? "bg-gold/20 text-ink" : "bg-red-50 text-red-700",
                    )}
                  >
                    {credit === 1 ? <Check className="h-3.5 w-3.5" aria-hidden /> : credit > 0 ? null : <X className="h-3.5 w-3.5" aria-hidden />}
                    {credit === 1 ? (weighted ? "Best answer" : "Correct") : credit > 0 ? "Partly effective" : weighted ? "Least effective" : "Incorrect"}
                  </span>
                </div>
                <p className="mt-1 font-bold">{q.prompt}</p>
                {q.visual && (
                  <div className="mt-3">
                    <VisualView v={q.visual} compact />
                  </div>
                )}
                <div className="mt-3 grid gap-2 text-sm">
                  {choice !== null && choice !== q.answer && (
                    <p>
                      <span className="font-bold text-red-700">Your answer: </span>
                      <OptionText q={q} i={choice} />
                    </p>
                  )}
                  <p>
                    <span className="font-bold text-success">{weighted ? "Best answer: " : "Correct answer: "}</span>
                    <OptionText q={q} i={q.answer} />
                  </p>
                  <p className="rounded-xl bg-mist p-3 text-ink/75">{q.explanation}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button className="mt-6" onClick={start}>
            <RotateCcw className="h-4 w-4" aria-hidden /> New attempt
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const elapsed = Math.floor((now - startedAt) / 1000);
  const answered = choices.filter((c) => c !== null).length;
  const toolOptions = q.options.some((o) => o.tool);
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 p-4 text-sm font-bold sm:px-6">
        <span>
          Question {index + 1} of {questions.length}
          <span className="ml-2 hidden font-normal text-ink/50 sm:inline">· {q.section}</span>
        </span>
        <span className={cn("flex items-center gap-1.5 tabular-nums", elapsed > suggestedMinutes * 60 && "text-maroon")}>
          <Timer className="h-4 w-4 text-maroon" aria-hidden /> {formatTime(elapsed)}
          <span className="font-normal text-ink/40">/ ~{suggestedMinutes}:00</span>
        </span>
      </div>
      <div className="h-1 bg-smoke" aria-hidden>
        <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${(answered / questions.length) * 100}%` }} />
      </div>

      <div className="p-5 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maroon sm:hidden">{q.section}</p>
        <h3 className="mt-1 text-lg font-black leading-snug sm:mt-0 sm:text-xl">{q.prompt}</h3>
        {q.visual && (
          <div className="mt-5">
            <VisualView v={q.visual} />
          </div>
        )}
        <div className={cn("mt-6 grid gap-3", toolOptions ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-2")} role="radiogroup" aria-label="Answers">
          {q.options.map((o, i) => {
            const selected = choices[index] === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(i)}
                className={cn(
                  "group flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 text-left transition",
                  selected ? "border-maroon bg-maroon/5 ring-4 ring-maroon/10" : "border-ink/10 bg-white hover:border-ink/30",
                  toolOptions && "flex-col items-center p-3 text-center",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black",
                    selected ? "bg-maroon text-white" : "bg-mist text-ink/60 group-hover:bg-ink/10",
                    toolOptions && "self-start",
                  )}
                >
                  {LETTERS[i]}
                </span>
                {o.tool ? (
                  <ToolArt id={o.tool} className="h-24 w-full sm:h-28" />
                ) : (
                  <span className={cn("pt-0.5 text-[15px] leading-snug text-ink", q.monoOptions && "font-mono font-bold tracking-wide")}>{o.text}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
          <p className="hidden text-xs text-ink/40 sm:block">Keys: A–{LETTERS[q.options.length - 1]} or 1–{q.options.length} to choose · Enter for next</p>
          <Button onClick={goNext} disabled={choices[index] === null || choices[index] === undefined}>
            {index + 1 >= questions.length ? "Finish" : "Next"} <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

function OptionText({ q, i }: { q: QuizQuestion; i: number }) {
  const o = q.options[i];
  if (o.tool) return <ToolName id={o.tool} />;
  return <span className={cn(q.monoOptions && "font-mono font-bold")}>{o.text}</span>;
}

function ToolName({ id }: { id: string }) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <ToolArt id={id} className="inline-block h-10 w-14" />
      <span className="font-bold">{TOOL_BY_ID[id]?.name ?? id}</span>
    </span>
  );
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VisualView({ v, compact = false }: { v: Visual; compact?: boolean }) {
  switch (v.type) {
    case "table":
      return (
        <div className="overflow-x-auto rounded-2xl border border-ink/10">
          <table className="w-full min-w-[420px] text-left text-sm">
            {v.caption && <caption className="bg-mist px-4 py-2 text-left text-xs font-bold uppercase tracking-widest text-ink/50">{v.caption}</caption>}
            <thead className="bg-mist text-xs uppercase tracking-wider text-ink/60">
              <tr>
                {v.headers.map((h) => (
                  <th key={h} className="px-4 py-2.5 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5 font-medium tabular-nums">
              {v.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={cn("px-4 py-2.5", j === 0 && "font-bold")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "bars": {
      const max = Math.max(...v.data.map((d) => d.value)) * 1.15;
      return (
        <figure className="rounded-2xl border border-ink/10 p-4">
          <figcaption className="text-xs font-bold uppercase tracking-widest text-ink/50">{v.title}</figcaption>
          <div className={cn("mt-4 flex items-end gap-2 sm:gap-4", compact ? "h-28" : "h-44")}>
            {v.data.map((d) => (
              <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-xs font-black tabular-nums">
                  {d.value}
                  {v.unit}
                </span>
                <div className="w-full max-w-14 rounded-t-lg bg-gradient-to-t from-maroon to-maroon/70" style={{ height: `${(d.value / max) * 100}%` }} />
                <span className="mt-1.5 text-xs font-bold text-ink/60">{d.label}</span>
              </div>
            ))}
          </div>
        </figure>
      );
    }
    case "pair":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {[v.left, v.right].map((x, i) => (
            <div key={i} className={cn("rounded-2xl border-2 border-ink/10 bg-mist px-4 text-center font-mono font-bold tracking-wider", compact ? "py-2 text-lg" : "py-5 text-2xl sm:text-3xl")}>
              {x}
            </div>
          ))}
        </div>
      );
    case "target":
      return (
        <div className={cn("mx-auto max-w-md rounded-2xl bg-ink px-4 text-center font-mono font-bold tracking-wider text-gold", compact ? "py-2 text-lg" : "py-5 text-2xl sm:text-3xl")}>
          {v.value}
        </div>
      );
    case "list":
      return (
        <ol className={cn("grid gap-1.5 rounded-2xl border border-ink/10 bg-mist p-4", v.mono && "font-mono font-bold tracking-wide sm:grid-cols-2")}>
          {v.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              {v.numbered !== false && <span className="w-6 shrink-0 text-right font-sans text-xs font-bold text-ink/40">{i + 1}.</span>}
              <span>{it}</span>
            </li>
          ))}
        </ol>
      );
    case "tool":
      return (
        <div className={cn("mx-auto flex items-center justify-center rounded-3xl bg-mist", compact ? "h-28 max-w-xs" : "h-56 max-w-md")}>
          <ToolArt id={v.tool} className={compact ? "h-24 w-full" : "h-48 w-full"} />
        </div>
      );
    case "scenario":
      return (
        <div className="rounded-2xl border-l-4 border-gold bg-gold/10 p-5">
          {v.context && <p className="text-xs font-bold uppercase tracking-widest text-maroon">{v.context}</p>}
          <p className={cn("leading-relaxed text-ink", compact ? "text-sm" : "text-[15px]")}>{v.text}</p>
        </div>
      );
  }
}
