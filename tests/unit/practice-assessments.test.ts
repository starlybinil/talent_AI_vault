import { describe, expect, it } from "vitest";
import { seededRng } from "@/lib/practice";
import { cognitiveQuiz, SECTIONS } from "@/lib/practice-cognitive";
import { toolsQuiz, TOOLS } from "@/lib/practice-tools";
import { judgementQuiz, SCENARIO_COUNT } from "@/lib/practice-judgement";
import { pickFresh, questionScore, summarize, type QuizQuestion } from "@/lib/quiz";
import { readFileSync } from "node:fs";
import path from "node:path";

function wellFormed(q: QuizQuestion) {
  expect(q.options.length).toBeGreaterThanOrEqual(2);
  expect(q.answer).toBeGreaterThanOrEqual(0);
  expect(q.answer).toBeLessThan(q.options.length);
  const keys = q.options.map((o) => o.text ?? o.tool);
  expect(new Set(keys).size).toBe(keys.length); // no duplicate options
  expect(q.explanation.length).toBeGreaterThan(10);
}

describe("cognitive ability practice", () => {
  it("builds 18 questions, 6 per section, across hundreds of random attempts", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const qs = cognitiveQuiz(seededRng(seed));
      expect(qs).toHaveLength(18);
      for (const s of Object.values(SECTIONS)) expect(qs.filter((q) => q.section === s)).toHaveLength(6);
      qs.forEach(wellFormed);
    }
  });

  it("never repeats the same test", () => {
    const a = cognitiveQuiz(seededRng(1)).map((q) => q.prompt + JSON.stringify(q.visual));
    const b = cognitiveQuiz(seededRng(2)).map((q) => q.prompt + JSON.stringify(q.visual));
    expect(a.join("|")).not.toEqual(b.join("|"));
  });
});

describe("hand tools practice", () => {
  it("has an illustration for every tool", () => {
    const art = readFileSync(path.resolve(__dirname, "../../src/components/practice/ToolArt.tsx"), "utf8");
    for (const t of TOOLS) expect(art).toMatch(new RegExp(`^\\s+"?${t.id}"?: \\(\\) =>`, "m"));
    expect(TOOLS.length).toBeGreaterThanOrEqual(30);
  });

  it("asks about the right tool in every question", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of toolsQuiz(seededRng(seed))) {
        wellFormed(q);
        const correct = q.options[q.answer];
        if (correct.tool) expect(correct.tool).toBe(q.id);
        else expect(correct.text).toBe(TOOLS.find((t) => t.id === q.id)!.name);
      }
    }
  });

  it("starts with tools not seen in recent attempts", () => {
    const first = toolsQuiz(seededRng(5));
    const second = toolsQuiz(seededRng(6), first.map((q) => q.id));
    const overlap = second.filter((q) => first.some((f) => f.id === q.id));
    expect(overlap).toHaveLength(0);
  });
});

describe("situational judgement practice", () => {
  it("scores responses 0–3 with one best answer and no unfilled placeholders", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const q of judgementQuiz(seededRng(seed))) {
        wellFormed(q);
        expect(q.options.map((o) => o.score).sort()).toEqual([0, 1, 2, 3]);
        expect(q.options[q.answer].score).toBe(3);
        const text = [q.visual && "text" in q.visual ? q.visual.text : "", ...q.options.map((o) => o.text), q.explanation].join(" ");
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("rotates scenarios between attempts", () => {
    expect(SCENARIO_COUNT).toBeGreaterThanOrEqual(20);
    const first = judgementQuiz(seededRng(9));
    const second = judgementQuiz(seededRng(10), first.map((q) => q.id));
    expect(second.filter((q) => first.some((f) => f.id === q.id))).toHaveLength(0);
  });

  it("gives partial credit for good-but-not-best answers", () => {
    const q = judgementQuiz(seededRng(3))[0];
    const second = q.options.findIndex((o) => o.score === 2);
    expect(questionScore(q, q.answer)).toBe(1);
    expect(questionScore(q, second)).toBeCloseTo(2 / 3);
  });
});

describe("quiz helpers", () => {
  it("summarizes overall and per-section scores", () => {
    const qs = cognitiveQuiz(seededRng(4));
    const s = summarize(qs, qs.map((q) => q.answer));
    expect(s.pct).toBe(100);
    expect(s.bySection).toHaveLength(3);
    expect(summarize(qs, qs.map(() => null)).pct).toBe(0);
  });

  it("pickFresh puts recently seen items last", () => {
    const pool = ["a", "b", "c", "d"].map((id) => ({ id }));
    const picked = pickFresh(seededRng(1), pool, 2, ["a", "b"]);
    expect(picked.map((p) => p.id).sort()).toEqual(["c", "d"]);
  });
});
