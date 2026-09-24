"use client";

import { Brain, Calculator, Eye } from "lucide-react";
import { seededRng } from "@/lib/practice";
import { cognitiveLevel, cognitiveQuiz } from "@/lib/practice-cognitive";
import { QuizRunner } from "@/components/practice/QuizRunner";

export function CognitiveTest({ personalBest, recent }: { personalBest: number | null; recent: string[] }) {
  return (
    <QuizRunner
      activity="cognitive"
      personalBest={personalBest}
      suggestedMinutes={15}
      level={cognitiveLevel}
      build={() => cognitiveQuiz(seededRng(Date.now()), recent)}
      intro={
        <div className="bg-gradient-to-br from-maroon to-maroon-900 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Cognitive ability · 18 questions · about 15 minutes</p>
          <h3 className="mt-2 text-2xl font-black">Think like a technician</h3>
          <p className="mt-2 max-w-2xl text-white/75">
            The kinds of questions pre-employment assessments use, set in a fab. Every attempt is newly generated, so you&apos;ll never see
            the same test twice. You get a full review with worked explanations at the end.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              [Calculator, "Numerical reasoning", "Percentages, ratios, fractions, costs, efficiency, tables and charts."],
              [Brain, "Problem solving & logic", "Patterns, deduction, rule-based decisions and ordering tasks."],
              [Eye, "Attention to detail", "Spot differences in codes and readings, and follow instructions exactly."],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof Brain;
              return (
                <div key={title as string} className="rounded-2xl bg-white/10 p-4">
                  <I className="h-5 w-5 text-gold" aria-hidden />
                  <p className="mt-2 font-black">{title as string}</p>
                  <p className="mt-1 text-sm text-white/70">{body as string}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-white/60">Tip: have scratch paper handy. A basic calculator is fine for practice.</p>
        </div>
      }
    />
  );
}
