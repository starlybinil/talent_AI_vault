"use client";

import { useEffect, useState } from "react";
import { BookOpen, EyeOff, ShieldCheck, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { seededRng } from "@/lib/practice";
import { TOOLS, TOOL_BY_ID, TOOL_CATEGORIES, toolsLevel, toolsQuiz, type HandTool } from "@/lib/practice-tools";
import { ToolArt } from "@/components/practice/ToolArt";
import { QuizRunner } from "@/components/practice/QuizRunner";

export function ToolsModule({ personalBest, recent }: { personalBest: number | null; recent: string[] }) {
  const [mode, setMode] = useState<"quiz" | "library">("quiz");
  return (
    <div className="grid gap-4">
      <div className="flex rounded-full bg-white p-1 shadow-sm ring-1 ring-ink/10" role="tablist" aria-label="Hand tools">
        {(
          [
            ["quiz", "Recognition quiz", Target],
            ["library", "Tool library", BookOpen],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition",
              mode === key ? "bg-ink text-white" : "text-ink/60 hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {mode === "quiz" ? (
        <QuizRunner
          activity="tools"
          accent="ink"
          personalBest={personalBest}
          suggestedMinutes={6}
          level={toolsLevel}
          build={() => toolsQuiz(seededRng(Date.now()), recent)}
          intro={
            <div className="bg-gradient-to-br from-ink to-ink-800 p-6 text-white sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Hand tools · 12 questions · about 6 minutes</p>
              <h3 className="mt-2 text-2xl font-black">Know your toolbox</h3>
              <p className="mt-2 max-w-2xl text-white/75">
                Technicians use these tools every day in fabs and advanced manufacturing plants. Name the tool, spot it in a line-up, and
                pick the right tool for the job. Each attempt uses a different mix, starting with tools you haven&apos;t seen recently.
              </p>
              <div className="mt-5 grid max-w-md grid-cols-4 gap-2">
                {["torque-wrench", "caliper", "wire-stripper", "micrometer"].map((id) => (
                  <div key={id} className="rounded-xl bg-white/10 p-1.5">
                    <ToolArt id={id} className="h-12 w-full" />
                  </div>
                ))}
              </div>
            </div>
          }
        />
      ) : (
        <ToolLibrary />
      )}
    </div>
  );
}

function ToolLibrary() {
  const [category, setCategory] = useState<string>("");
  const [hideNames, setHideNames] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<HandTool | null>(null);
  const tools = TOOLS.filter((t) => !category || t.category === category);

  const onCard = (t: HandTool) => {
    if (hideNames && !revealed.has(t.id)) setRevealed(new Set(revealed).add(t.id));
    else setOpen(t);
  };

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
      <div className="flex flex-col gap-3 border-b border-ink/10 p-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {["", ...TOOL_CATEGORIES].map((c) => (
            <button
              key={c || "all"}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition",
                category === c ? "border-maroon bg-maroon text-white" : "border-ink/15 text-ink/70 hover:border-maroon hover:text-maroon",
              )}
            >
              {c || `All ${TOOLS.length}`}
            </button>
          ))}
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-bold text-ink/70">
          <input
            type="checkbox"
            checked={hideNames}
            onChange={(e) => {
              setHideNames(e.target.checked);
              setRevealed(new Set());
            }}
            className="h-4 w-4 accent-maroon"
          />
          <EyeOff className="h-4 w-4" aria-hidden /> Hide names (quiz yourself)
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 sm:px-6 lg:grid-cols-4">
        {tools.map((t) => {
          const hidden = hideNames && !revealed.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onCard(t)}
              className="group cursor-pointer rounded-2xl border border-ink/10 bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-maroon hover:shadow-md"
            >
              <div className="rounded-xl bg-mist p-1">
                <ToolArt id={t.id} className="h-24 w-full" />
              </div>
              <p className={cn("mt-2 text-sm font-black", hidden && "text-ink/30")}>{hidden ? "Tap to reveal" : t.name}</p>
              {!hidden && <p className="text-[11px] font-bold uppercase tracking-wider text-ink/40">{t.category}</p>}
            </button>
          );
        })}
      </div>
      {open && <ToolDetail tool={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ToolDetail({ tool, onClose }: { tool: HandTool; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const t = TOOL_BY_ID[tool.id];
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="tool-title" className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 cursor-pointer rounded-full bg-white/80 p-1.5 text-ink/50 hover:text-ink" aria-label="Close" autoFocus>
          <X className="h-5 w-5" />
        </button>
        <div className="bg-mist p-6">
          <ToolArt id={t.id} className="mx-auto h-48 w-full max-w-sm" />
        </div>
        <div className="p-6 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maroon">{t.category}</p>
          <h3 id="tool-title" className="mt-1 text-2xl font-black">
            {t.name}
          </h3>
          {t.aka && <p className="text-sm text-ink/50">Also called: {t.aka}</p>}
          <p className="mt-3 text-ink/80">{t.use}</p>
          <p className="mt-4 flex gap-2 rounded-2xl bg-gold/15 p-4 text-sm text-ink/80">
            <ShieldCheck className="h-5 w-5 shrink-0 text-maroon" aria-hidden />
            <span>
              <strong className="text-ink">Tip: </strong>
              {t.tip}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
