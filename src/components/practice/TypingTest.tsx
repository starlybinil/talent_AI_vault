"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Keyboard, RotateCcw, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { savePracticeAttempt } from "@/app/portal/actions";
import { scoreTyping, seededRng, typingLevel, typingText, type TypingResult } from "@/lib/practice";

const DURATIONS = [30, 60, 120] as const;
type Phase = "ready" | "running" | "done";

export function TypingTest({ personalBest }: { personalBest: number | null }) {
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(60);
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("ready");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<(TypingResult & { seconds: number }) | null>(null);
  const [saved, setSaved] = useState<{ previousBest: number | null } | null>(null);
  const keystrokes = useRef(0);
  const wrong = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  const reset = useCallback(() => {
    setText(typingText(seededRng(Date.now())));
    setTyped("");
    setPhase("ready");
    setStartedAt(null);
    setResult(null);
    setSaved(null);
    keystrokes.current = 0;
    wrong.current = 0;
    if (boxRef.current) boxRef.current.scrollTop = 0;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // New passage on the client only (keeps server and client markup identical).
  useEffect(() => {
    reset();
  }, [reset]);

  const finish = useCallback(
    (endTime: number, finalTyped: string) => {
      if (!startedAt) return;
      const seconds = Math.max(1, Math.round((endTime - startedAt) / 1000));
      const r = scoreTyping(text, finalTyped, seconds, keystrokes.current, wrong.current);
      setResult({ ...r, seconds });
      setPhase("done");
      savePracticeAttempt({
        activity: "typing",
        score: Math.min(r.wpm, 300),
        accuracy: r.accuracy,
        durationSeconds: seconds,
        details: { rawWpm: r.rawWpm, errors: r.errors, chosenSeconds: duration },
      }).then((res) => setSaved(res.ok ? { previousBest: res.previousBest ?? null } : null));
    },
    [startedAt, text, duration],
  );

  useEffect(() => {
    if (phase !== "running" || !startedAt) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - startedAt >= duration * 1000) finish(startedAt + duration * 1000, inputRef.current?.value ?? "");
    }, 200);
    return () => clearInterval(id);
  }, [phase, startedAt, duration, finish]);

  // Keep the current line in view.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const caret = caretRef.current;
    if (box && caret) box.scrollTop = Math.max(0, caret.offsetTop - box.clientHeight / 3);
  }, [typed]);

  const onChange = (value: string) => {
    if (phase === "done" || !text) return;
    const next = value.slice(0, text.length);
    let start = startedAt;
    if (phase === "ready" && next.length > 0) {
      start = Date.now();
      setStartedAt(start);
      setNow(start);
      setPhase("running");
    }
    if (next.length > typed.length) {
      for (let i = typed.length; i < next.length; i++) {
        keystrokes.current++;
        if (next[i] !== text[i]) wrong.current++;
      }
    }
    setTyped(next);
    if (next.length === text.length && start) finish(Date.now(), next);
  };

  const elapsed = startedAt ? Math.min(duration, (now - startedAt) / 1000) : 0;
  const live = scoreTyping(text, typed, Math.max(elapsed, 1), keystrokes.current, wrong.current);
  const remaining = Math.max(0, Math.ceil(duration - elapsed));

  if (phase === "done" && result) {
    const level = typingLevel(result.wpm);
    const newBest = saved && (saved.previousBest === null || result.wpm > saved.previousBest);
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
        <div className="bg-gradient-to-br from-ink to-ink-800 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Typing result · {level.label}</p>
          <p className="mt-2 flex items-end gap-2">
            <span className="text-6xl font-black tabular-nums tracking-tight">{Math.round(result.wpm)}</span>
            <span className="mb-2 text-lg font-bold text-white/70">words per minute</span>
          </p>
          <p className="mt-1 text-white/70">{level.note}</p>
          {newBest && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1 text-sm font-black text-ink">
              <Trophy className="h-4 w-4" aria-hidden /> New personal best!
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-px bg-ink/10 sm:grid-cols-4">
          <ResultStat label="Accuracy" value={`${result.accuracy}%`} />
          <ResultStat label="Raw speed" value={`${Math.round(result.rawWpm)} wpm`} />
          <ResultStat label="Uncorrected errors" value={result.errors} />
          <ResultStat label="Time" value={`${result.seconds}s`} />
        </div>
        <div className="flex flex-wrap items-center gap-3 p-6">
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </Button>
          <p className="text-sm text-ink/60">Tip: accuracy matters more than speed. Aim for 95%+ and the speed will come.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 p-4 sm:px-6">
        <div className="flex items-center gap-1 rounded-full bg-mist p-1" role="radiogroup" aria-label="Test length">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={duration === d}
              disabled={phase === "running"}
              onClick={() => setDuration(d)}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed",
                duration === d ? "bg-ink text-white" : "text-ink/60 hover:text-ink",
              )}
            >
              {d < 60 ? `${d}s` : `${d / 60} min`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-5 text-sm font-bold tabular-nums" aria-live="off">
          <span className="flex items-center gap-1.5">
            <Timer className="h-4 w-4 text-maroon" aria-hidden /> {remaining}s
          </span>
          {/* The first seconds give wild numbers, so live stats appear after a short warm-up. */}
          <span>{phase === "running" && elapsed >= 3 ? Math.round(live.wpm) : "–"} wpm</span>
          <span>{phase === "running" && keystrokes.current > 0 ? live.accuracy : 100}%</span>
          <button type="button" onClick={reset} className="cursor-pointer rounded-full p-1.5 text-ink/50 hover:bg-mist hover:text-ink" aria-label="New passage">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative p-4 sm:p-6">
        <div className="h-1 overflow-hidden rounded-full bg-smoke" aria-hidden>
          <div className="h-full bg-gold transition-[width] duration-200" style={{ width: `${(elapsed / duration) * 100}%` }} />
        </div>
        <div
          ref={boxRef}
          onClick={() => inputRef.current?.focus()}
          className="relative mt-4 h-44 cursor-text overflow-hidden font-mono text-lg leading-9 sm:text-xl sm:leading-10"
        >
          {text ? (
            <p className="whitespace-pre-wrap break-words">
              {[...text].map((ch, i) => {
                const state = i < typed.length ? (typed[i] === ch ? "ok" : "bad") : i === typed.length ? "caret" : "todo";
                return (
                  <span
                    key={i}
                    ref={state === "caret" ? caretRef : undefined}
                    className={cn(
                      state === "ok" && "text-ink",
                      state === "bad" && "rounded-sm bg-red-100 text-red-700",
                      state === "todo" && "text-ink/35",
                      state === "caret" && "border-b-[3px] border-gold text-ink/60",
                    )}
                  >
                    {ch}
                  </span>
                );
              })}
            </p>
          ) : (
            <p className="text-ink/40">Loading passage…</p>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white" aria-hidden />
        </div>
        <textarea
          ref={inputRef}
          value={typed}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Type the passage here"
          className="absolute inset-0 h-full w-full cursor-text resize-none opacity-0"
        />
        {phase === "ready" && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink/60">
            <Keyboard className="h-4 w-4" aria-hidden /> Click the text and start typing. The timer starts on your first key.
            {personalBest !== null && <span className="ml-auto font-bold text-ink">Your best: {Math.round(personalBest)} wpm</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-ink">{value}</p>
    </div>
  );
}
