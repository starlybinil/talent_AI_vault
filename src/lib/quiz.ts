/** Shared shape for the Practice Lab's multiple-choice assessments (cognitive, hand tools, situational judgement). */

export type Visual =
  | { type: "table"; headers: string[]; rows: Array<Array<string | number>>; caption?: string }
  | { type: "bars"; title: string; unit: string; data: Array<{ label: string; value: number }> }
  | { type: "pair"; left: string; right: string }
  | { type: "target"; value: string }
  | { type: "list"; items: string[]; mono?: boolean; numbered?: boolean }
  | { type: "tool"; tool: string }
  | { type: "scenario"; text: string; context?: string };

export type QuizOption = { text?: string; tool?: string; score?: number };

export type QuizQuestion = {
  /** Stable id of the underlying item (tool, scenario, template) used to avoid repeats across attempts. */
  id: string;
  section: string;
  prompt: string;
  visual?: Visual;
  options: QuizOption[];
  /** Index of the best answer. */
  answer: number;
  explanation: string;
  monoOptions?: boolean;
};

/** 0–1 credit for a choice: weighted when options carry scores (situational judgement), else right/wrong. */
export function questionScore(q: QuizQuestion, choice: number | null): number {
  if (choice === null || choice < 0 || choice >= q.options.length) return 0;
  const scored = q.options.some((o) => typeof o.score === "number");
  if (!scored) return choice === q.answer ? 1 : 0;
  const max = Math.max(...q.options.map((o) => o.score ?? 0));
  return max > 0 ? (q.options[choice].score ?? 0) / max : 0;
}

export type QuizSummary = { pct: number; correct: number; total: number; bySection: Array<{ section: string; pct: number; total: number }> };

export function summarize(questions: QuizQuestion[], choices: Array<number | null>): QuizSummary {
  const credits = questions.map((q, i) => questionScore(q, choices[i] ?? null));
  const sections = Array.from(new Set(questions.map((q) => q.section)));
  const pct = questions.length ? Math.round((credits.reduce((a, b) => a + b, 0) / questions.length) * 1000) / 10 : 0;
  return {
    pct,
    correct: credits.filter((c) => c === 1).length,
    total: questions.length,
    bySection: sections.map((section) => {
      const idx = questions.map((q, i) => (q.section === section ? i : -1)).filter((i) => i >= 0);
      const got = idx.reduce((a, i) => a + credits[i], 0);
      return { section, total: idx.length, pct: Math.round((got / idx.length) * 100) };
    }),
  };
}

/** Pick `count` items, preferring ones not in `recent` so consecutive attempts don't repeat. */
export function pickFresh<T extends { id: string }>(rng: () => number, pool: readonly T[], count: number, recent: readonly string[]): T[] {
  const recentSet = new Set(recent);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const fresh = shuffled.filter((x) => !recentSet.has(x.id));
  const stale = shuffled.filter((x) => recentSet.has(x.id));
  return [...fresh, ...stale].slice(0, count);
}
