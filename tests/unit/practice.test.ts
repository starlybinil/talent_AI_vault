import { describe, expect, it } from "vitest";
import { attentionItems, diffIndexes, mutate, scoreTyping, seededRng, typingText } from "@/lib/practice";

describe("typing test", () => {
  it("builds a passage long enough for two minutes", () => {
    expect(typingText(seededRng(1)).split(" ").length).toBeGreaterThanOrEqual(220);
  });

  it("scores net WPM from correct characters (5 chars = 1 word)", () => {
    const target = "abcde fghij klmno";
    const r = scoreTyping(target, "abcde fghij", 60, 11, 0);
    expect(r.wpm).toBe(2.2);
    expect(r.accuracy).toBe(100);
    expect(r.errors).toBe(0);
  });

  it("counts uncorrected errors and keystroke accuracy", () => {
    const r = scoreTyping("hello world", "hallo world", 30, 12, 2);
    expect(r.errors).toBe(1);
    expect(r.correctChars).toBe(10);
    expect(r.accuracy).toBeCloseTo(83.3, 1);
  });
});

describe("attention drill", () => {
  it("makes a new set of 20 items, with both question types", () => {
    const items = attentionItems(seededRng(42));
    expect(items).toHaveLength(20);
    expect(items.some((i) => i.type === "compare")).toBe(true);
    expect(items.some((i) => i.type === "match")).toBe(true);
    expect(JSON.stringify(attentionItems(seededRng(43)))).not.toEqual(JSON.stringify(items));
  });

  it("keeps compare answers honest", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const item of attentionItems(seededRng(seed))) {
        if (item.type === "compare") expect(item.left === item.right).toBe(item.same);
      }
    }
  });

  it("has exactly one exact match among four distinct options", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const item of attentionItems(seededRng(seed))) {
        if (item.type !== "match") continue;
        expect(item.options).toHaveLength(4);
        expect(new Set(item.options).size).toBe(4);
        expect(item.options.filter((o) => o === item.target)).toHaveLength(1);
        expect(item.options[item.answer]).toBe(item.target);
      }
    }
  });

  it("mutations are subtle but never identical", () => {
    const rng = seededRng(7);
    for (const s of ["AZ3K1047.52", "SN-KT42-8810-B", "12.50 mTorr", "ETCH_B07_V2.1"]) {
      for (let i = 0; i < 30; i++) {
        const m = mutate(rng, s);
        expect(m).not.toBe(s);
        expect(Math.abs(m.length - s.length)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("highlights only the part that changed", () => {
    expect(diffIndexes("AB-1234", "AB-1284")).toEqual([5]);
    expect(diffIndexes("AB-1234", "AB-1324")).toEqual([4, 5]);
    expect(diffIndexes("AB-12234", "AB-1234")).toEqual([5]); // the extra "2"
    expect(diffIndexes("same", "same")).toEqual([]);
  });
});

describe("realistic mutations", () => {
  it("never changes unit words", () => {
    const rng = seededRng(99);
    for (const s of ["O2-L87 @ 93 psi", "17.27 mTorr", "12.5 N·m ±3%"]) {
      const unit = s.match(/[a-z]{2,}/)?.[0] ?? "";
      for (let i = 0; i < 50; i++) expect(mutate(rng, s)).toContain(unit);
    }
  });
});
