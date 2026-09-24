"use client";

import { seededRng } from "@/lib/practice";
import { COMPETENCIES, judgementLevel, judgementQuiz } from "@/lib/practice-judgement";
import { QuizRunner } from "@/components/practice/QuizRunner";

export function JudgementTest({ personalBest, recent }: { personalBest: number | null; recent: string[] }) {
  return (
    <QuizRunner
      activity="judgement"
      weighted
      personalBest={personalBest}
      suggestedMinutes={10}
      level={judgementLevel}
      build={() => judgementQuiz(seededRng(Date.now()), recent)}
      intro={
        <div className="bg-gradient-to-br from-maroon to-maroon-900 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Situational judgement · 10 scenarios · about 10 minutes</p>
          <h3 className="mt-2 text-2xl font-black">What would you do?</h3>
          <p className="mt-2 max-w-2xl text-white/75">
            Real situations technicians face on the job. Choose the <strong className="text-white">most effective</strong> response. Every
            answer earns some credit, but the best one earns full marks. Scenarios you haven&apos;t seen come first.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {Object.values(COMPETENCIES).map((c) => (
              <span key={c} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                {c}
              </span>
            ))}
          </div>
        </div>
      }
    />
  );
}
