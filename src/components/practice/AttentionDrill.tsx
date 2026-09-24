"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, RotateCcw, Timer, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { savePracticeAttempt } from "@/app/portal/actions";
import { attentionItems, attentionLevel, diffIndexes, seededRng, type AttentionItem } from "@/lib/practice";

const TOTAL = 20;
type Answer = { item: AttentionItem; choice: boolean | number; correct: boolean; ms: number };

export function AttentionDrill({ personalBest }: { personalBest: number | null }) {
  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [itemStartedAt, setItemStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [saved, setSaved] = useState<{ previousBest: number | null } | null>(null);
  const locked = useRef(false);

  const start = () => {
    const t = Date.now();
    setItems(attentionItems(seededRng(t), TOTAL));
    setIndex(0);
    setAnswers([]);
    setFeedback(null);
    setSaved(null);
    setStartedAt(t);
    setItemStartedAt(t);
    setNow(t);
    locked.current = false;
    setPhase("running");
  };

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  const answer = useCallback(
    (choice: boolean | number) => {
      if (phase !== "running" || locked.current) return;
      const item = items[index];
      if (!item) return;
      locked.current = true;
      const correct = item.type === "compare" ? choice === item.same : choice === item.answer;
      const next = [...answers, { item, choice, correct, ms: Date.now() - itemStartedAt }];
      setAnswers(next);
      setFeedback(correct);
      setTimeout(() => {
        setFeedback(null);
        locked.current = false;
        if (index + 1 >= items.length) {
          const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
          const right = next.filter((a) => a.correct).length;
          const pct = Math.round((right / next.length) * 1000) / 10;
          setPhase("done");
          savePracticeAttempt({
            activity: "attention",
            score: pct,
            accuracy: pct,
            durationSeconds: seconds,
            details: { correct: right, total: next.length, avgSeconds: Math.round((seconds / next.length) * 10) / 10 },
          }).then((res) => setSaved(res.ok ? { previousBest: res.previousBest ?? null } : null));
        } else {
          setIndex(index + 1);
          setItemStartedAt(Date.now());
        }
      }, 550);
    },
    [phase, items, index, answers, itemStartedAt, startedAt],
  );

  // Keyboard: S / D for compare, 1–4 for match.
  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      const item = items[index];
      if (!item || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (item.type === "compare" && (k === "s" || k === "d")) answer(k === "s");
      if (item.type === "match" && ["1", "2", "3", "4"].includes(k)) answer(Number(k) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, items, index, answer]);

  if (phase === "intro") {
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
        <div className="bg-gradient-to-br from-maroon to-maroon-900 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Attention to detail · {TOTAL} questions · about 3 minutes</p>
          <h3 className="mt-2 text-2xl font-black">Catch the difference that matters</h3>
          <p className="mt-2 max-w-2xl text-white/75">
            Technicians compare part numbers, lot IDs and readings all day, and one wrong character can mean the wrong part or a scrapped wafer. Every
            round is new, so practise as often as you like.
          </p>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
          <div className="rounded-2xl bg-mist p-5">
            <p className="font-black">Same or different?</p>
            <p className="mt-1 text-sm text-ink/70">Two codes side by side. Decide whether they match exactly.</p>
            <p className="mt-3 text-xs font-bold text-ink/50">
              Keys: <Kbd>S</Kbd> same · <Kbd>D</Kbd> different
            </p>
          </div>
          <div className="rounded-2xl bg-mist p-5">
            <p className="font-black">Find the exact match</p>
            <p className="mt-1 text-sm text-ink/70">One target, four look-alikes. Pick the only exact copy.</p>
            <p className="mt-3 text-xs font-bold text-ink/50">
              Keys: <Kbd>1</Kbd>–<Kbd>4</Kbd>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <Button size="lg" onClick={start}>
              <Eye className="h-5 w-5" aria-hidden /> Start
            </Button>
            {personalBest !== null && <p className="text-sm font-bold text-ink/70">Your best: {Math.round(personalBest)}%</p>}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const right = answers.filter((a) => a.correct).length;
    const pct = Math.round((right / answers.length) * 100);
    const seconds = Math.max(1, Math.round(answers.reduce((s, a) => s + a.ms, 0) / 1000));
    const level = attentionLevel(pct);
    const newBest = saved && (saved.previousBest === null || pct > saved.previousBest);
    const misses = answers.filter((a) => !a.correct);
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
        <div className="bg-gradient-to-br from-maroon to-maroon-900 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Attention to detail · {level.label}</p>
          <p className="mt-2 flex items-end gap-3">
            <span className="text-6xl font-black tabular-nums tracking-tight">{pct}%</span>
            <span className="mb-2 text-lg font-bold text-white/70">
              {right} of {answers.length} correct
            </span>
          </p>
          <p className="mt-1 text-white/75">{level.note}</p>
          {newBest && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1 text-sm font-black text-ink">
              <Trophy className="h-4 w-4" aria-hidden /> New personal best!
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-px bg-ink/10">
          <Stat label="Correct" value={`${right}/${answers.length}`} />
          <Stat label="Total time" value={`${seconds}s`} />
          <Stat label="Per question" value={`${(seconds / answers.length).toFixed(1)}s`} />
        </div>
        <div className="p-6 sm:p-8">
          {misses.length === 0 ? (
            <p className="font-bold text-success">Perfect round. Every detail caught.</p>
          ) : (
            <>
              <p className="font-black">Review what you missed</p>
              <p className="text-sm text-ink/60">Differences are highlighted.</p>
              <ul className="mt-4 grid gap-3">
                {misses.map((a, i) => (
                  <li key={i} className="rounded-2xl border border-ink/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-ink/50">{a.item.kind}</p>
                    {a.item.type === "compare" ? (
                      <div className="mt-2 text-sm">
                        <div className="flex flex-wrap gap-3 font-mono text-base">
                          <Marked text={a.item.left} other={a.item.right} />
                          <span className="text-ink/30">vs</span>
                          <Marked text={a.item.right} other={a.item.left} />
                        </div>
                        <p className="mt-1 text-ink/60">
                          These were <strong>{a.item.same ? "the same" : "different"}</strong>; you answered {a.choice ? "same" : "different"}.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm">
                        <p className="font-mono text-base">
                          Target: <span className="font-bold">{a.item.target}</span>
                        </p>
                        <p className="mt-1 font-mono text-base">
                          You picked: <Marked text={a.item.options[a.choice as number]} other={a.item.target} />
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Button className="mt-6" onClick={start}>
            <RotateCcw className="h-4 w-4" aria-hidden /> New round
          </Button>
        </div>
      </div>
    );
  }

  const item = items[index];
  const elapsed = Math.floor((now - startedAt) / 1000);
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 p-4 text-sm font-bold sm:px-6">
        <span>
          Question {index + 1} of {items.length}
        </span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <Timer className="h-4 w-4 text-maroon" aria-hidden /> {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="h-1 bg-smoke" aria-hidden>
        <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${(answers.length / items.length) * 100}%` }} />
      </div>
      <div className={cn("relative p-6 transition-colors sm:p-10", feedback === true && "bg-emerald-50", feedback === false && "bg-red-50")}>
        {feedback !== null && (
          <span
            className={cn(
              "absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full text-white",
              feedback ? "bg-success" : "bg-red-600",
            )}
            aria-live="assertive"
            aria-label={feedback ? "Correct" : "Incorrect"}
          >
            {feedback ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
          </span>
        )}
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-maroon">{item.kind}</p>
        {item.type === "compare" ? (
          <>
            <p className="mt-1 text-center text-lg font-black">Are these exactly the same?</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[item.left, item.right].map((v, i) => (
                <div key={i} className="rounded-2xl border-2 border-ink/10 bg-mist px-4 py-6 text-center font-mono text-2xl font-bold tracking-wider sm:text-3xl">
                  {v}
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button size="lg" variant="dark" onClick={() => answer(true)}>
                Same <Kbd dark>S</Kbd>
              </Button>
              <Button size="lg" variant="outline" onClick={() => answer(false)}>
                Different <Kbd>D</Kbd>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-center text-lg font-black">Find the exact match</p>
            <div className="mx-auto mt-5 max-w-md rounded-2xl bg-ink px-4 py-5 text-center font-mono text-2xl font-bold tracking-wider text-gold sm:text-3xl">
              {item.target}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {item.options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => answer(i)}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white px-4 py-4 text-left font-mono text-xl font-bold tracking-wider transition hover:border-maroon"
                >
                  <Kbd>{i + 1}</Kbd>
                  {o}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Marked({ text, other }: { text: string; other: string }) {
  const diff = new Set(diffIndexes(text, other));
  return (
    <span className="font-bold">
      {[...text].map((ch, i) => (
        <span key={i} className={diff.has(i) ? "rounded bg-gold px-0.5 text-ink" : undefined}>
          {ch}
        </span>
      ))}
    </span>
  );
}

function Kbd({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-6 items-center justify-center rounded-md border px-1.5 py-0.5 font-sans text-xs font-black",
        dark ? "border-white/30 text-white/80" : "border-ink/20 bg-white text-ink/70",
      )}
    >
      {children}
    </kbd>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-ink">{value}</p>
    </div>
  );
}
