/**
 * Practice Lab: typing-speed passages and scoring, and the attention-to-detail item generator.
 * Everything here is pure so it can be unit-tested; randomness comes from an injectable RNG.
 */

export type Rng = () => number;

/** Small deterministic PRNG (mulberry32) so tests can use fixed seeds. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
export const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

export function shuffle<T>(rng: Rng, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Typing
// ---------------------------------------------------------------------------

export const TYPING_PASSAGES = [
  "Before entering the cleanroom, technicians put on a full gown, hood, boots, gloves and safety glasses. Every step follows a set order so that no particles are carried onto the fab floor, where a single speck of dust can ruin a wafer.",
  "A vacuum chamber must reach its base pressure before a process can start. If the pressure rises too slowly or stays too high, the technician checks the seals, the pump and the gauges, then records every reading in the equipment log.",
  "Preventive maintenance keeps tools running. The technician follows the checklist, replaces worn parts, verifies torque values and calibrates each sensor. When the work is done, the tool is qualified with a test wafer before it returns to production.",
  "Lockout and tagout protect people who work on equipment. Each energy source is identified, switched off and locked. The technician then tries to start the tool to prove that it is safe before any panel is opened.",
  "Pneumatic valves open and close with compressed air. When a valve responds slowly, check the air supply pressure, look for leaks in the tubing and confirm that the solenoid receives the correct signal from the controller.",
  "Wafers travel through the fab in sealed pods. Robots move each pod between tools while the software tracks the lot number, the recipe and the time spent at every step. Accurate records make it possible to trace any problem to its source.",
  "A multimeter can measure voltage, current and resistance. Always select the correct range, connect the probes to the right ports and confirm that the circuit is de-energized before measuring resistance or continuity.",
  "Good technicians communicate clearly. At shift change they report what was repaired, what is still open and which tools need attention, so the next team can continue the work without delay or confusion.",
] as const;

/** Text long enough for the chosen duration (passages joined in a random order). */
export function typingText(rng: Rng, words = 220): string {
  const order = shuffle(rng, [...TYPING_PASSAGES]);
  const out: string[] = [];
  let count = 0;
  for (let i = 0; count < words; i++) {
    const p = order[i % order.length];
    out.push(p);
    count += p.split(" ").length;
  }
  return out.join(" ");
}

export type TypingResult = { wpm: number; rawWpm: number; accuracy: number; correctChars: number; typedChars: number; errors: number };

/**
 * Standard scoring: a "word" is 5 characters. Net WPM counts only correctly typed characters;
 * accuracy is correct keystrokes / all keystrokes (so fixing a mistake still costs accuracy).
 */
export function scoreTyping(target: string, typed: string, seconds: number, keystrokes: number, wrongKeystrokes: number): TypingResult {
  const minutes = Math.max(seconds, 1) / 60;
  let correctChars = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) correctChars++;
  const errors = typed.length - correctChars;
  const accuracy = keystrokes > 0 ? Math.max(0, ((keystrokes - wrongKeystrokes) / keystrokes) * 100) : 0;
  return {
    wpm: round1(correctChars / 5 / minutes),
    rawWpm: round1(typed.length / 5 / minutes),
    accuracy: round1(accuracy),
    correctChars,
    typedChars: typed.length,
    errors,
  };
}

export function typingLevel(wpm: number): { label: string; note: string } {
  if (wpm >= 60) return { label: "Excellent", note: "Faster than most professional typists." };
  if (wpm >= 45) return { label: "Strong", note: "Comfortably above average." };
  if (wpm >= 30) return { label: "Good", note: "Solid, workplace-ready speed. Keep practising for accuracy." };
  return { label: "Building", note: "Focus on accuracy first; speed follows with practice." };
}

// ---------------------------------------------------------------------------
// Attention to detail
// ---------------------------------------------------------------------------

/** Characters that are easy to confuse at a glance. */
const LOOKALIKES: Record<string, string[]> = {
  "0": ["O", "8"],
  O: ["0", "Q", "D"],
  "1": ["7", "I"],
  I: ["1", "L"],
  "5": ["S", "6"],
  S: ["5", "8"],
  "8": ["B", "3", "6"],
  B: ["8", "R"],
  "2": ["Z", "7"],
  Z: ["2"],
  "6": ["G", "8", "5"],
  G: ["6", "C"],
  "3": ["8", "9"],
  "9": ["4", "3"],
  "4": ["9", "A"],
  A: ["4"],
  "7": ["1", "2"],
  E: ["F", "B"],
  F: ["E", "P"],
  M: ["N", "W"],
  N: ["M", "H"],
  U: ["V"],
  V: ["U", "Y"],
  C: ["G", "O"],
  D: ["O", "0"],
  P: ["R", "F"],
  R: ["P", "B"],
  T: ["7", "Y"],
  ".": [","],
};

const LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";

function code(rng: Rng, pattern: string): string {
  return pattern.replace(/[#A]/g, (ch) => (ch === "#" ? String(int(rng, 0, 9)) : LETTERS[int(rng, 0, LETTERS.length - 1)]));
}

/** Realistic fab identifiers: part numbers, lot IDs, serials, readings, recipe names. */
const GENERATORS: Array<{ kind: string; make: (rng: Rng) => string }> = [
  { kind: "Part number", make: (r) => code(r, "AA-####-A#") },
  { kind: "Lot ID", make: (r) => code(r, "AZ#A####.##") },
  { kind: "Serial number", make: (r) => code(r, "SN-AA##-####-A") },
  { kind: "Chamber reading", make: (r) => `${int(r, 1, 99)}.${int(r, 0, 9)}${int(r, 0, 9)} mTorr` },
  { kind: "Recipe", make: (r) => code(r, "ETCH_A##_V#.#") },
  { kind: "Work order", make: (r) => code(r, "WO-######-A") },
  { kind: "Gas line", make: (r) => `${pick(r, ["N2", "O2", "Ar", "He", "CF4", "SF6"])}-${code(r, "L##")} @ ${int(r, 10, 95)} psi` },
  { kind: "Torque spec", make: (r) => `${int(r, 5, 45)}.${int(r, 0, 9)} N·m ±${int(r, 1, 5)}%` },
];

/** A random realistic fab identifier (part number, lot ID, reading…) and what kind it is. */
export function fabCode(rng: Rng): { kind: string; value: string } {
  const g = pick(rng, GENERATORS);
  return { kind: g.kind, value: g.make(rng) };
}

/** A copy of `s` with one subtle, realistic change (never identical to the input). */
export function mutate(rng: Rng, s: string): string {
  // Only digits, capitals and decimal points change (never unit words like "psi" or "mTorr").
  const positions = [...s].map((ch, i) => ({ ch, i })).filter(({ ch }) => /[A-Z0-9.]/.test(ch));
  for (let attempt = 0; attempt < 20; attempt++) {
    const kind = int(rng, 0, 9);
    const { ch, i } = pick(rng, positions);
    let out = s;
    if (kind <= 5 && LOOKALIKES[ch]) {
      out = s.slice(0, i) + pick(rng, LOOKALIKES[ch]) + s.slice(i + 1); // look-alike swap
    } else if (kind <= 7) {
      // swap with the next alphanumeric neighbour (transposition)
      const j = i + 1;
      if (j < s.length && /[A-Z0-9]/.test(s[j]) && /[A-Z0-9]/.test(ch) && s[j] !== ch) out = s.slice(0, i) + s[j] + ch + s.slice(j + 1);
    } else if (kind === 8 && /[0-9]/.test(ch)) {
      out = s.slice(0, i) + String((Number(ch) + int(rng, 1, 8)) % 10) + s.slice(i + 1); // digit change
    } else if (/[0-9]/.test(ch) && i > 0 && /[0-9]/.test(s[i - 1])) {
      out = s.slice(0, i) + ch + s.slice(i); // doubled digit
    }
    if (out !== s) return out;
  }
  return s.slice(0, -1) + (s.endsWith("A") ? "B" : "A");
}

export type CompareItem = { type: "compare"; kind: string; left: string; right: string; same: boolean };
export type MatchItem = { type: "match"; kind: string; target: string; options: string[]; answer: number };
export type AttentionItem = CompareItem | MatchItem;

export function attentionItems(rng: Rng, count = 20): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (let n = 0; n < count; n++) {
    const g = pick(rng, GENERATORS);
    const value = g.make(rng);
    if (n % 3 === 2) {
      // Find the exact match among look-alikes.
      const decoys = new Set<string>();
      while (decoys.size < 3) {
        const d = mutate(rng, value);
        if (d !== value) decoys.add(d);
      }
      const options = shuffle(rng, [value, ...decoys]);
      items.push({ type: "match", kind: g.kind, target: value, options, answer: options.indexOf(value) });
    } else {
      const same = rng() < 0.45;
      items.push({ type: "compare", kind: g.kind, left: value, right: same ? value : mutate(rng, value), same });
    }
  }
  return items;
}

/**
 * Indexes in `a` that differ from `b`, for highlighting mistakes in the review. Uses the shared
 * prefix and suffix so an inserted or swapped character only marks the part that changed.
 */
export function diffIndexes(a: string, b: string): number[] {
  if (a === b) return [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }
  const out: number[] = [];
  for (let i = start; i <= endA; i++) out.push(i);
  // Pure deletion from `a`'s point of view: mark the character where the gap is.
  if (out.length === 0 && start < a.length) out.push(start);
  return out;
}

export function attentionLevel(pct: number): { label: string; note: string } {
  if (pct >= 95) return { label: "Sharp eye", note: "Excellent. You caught almost every detail." };
  if (pct >= 85) return { label: "Strong", note: "Very good. Review the ones you missed to spot the pattern." };
  if (pct >= 70) return { label: "Developing", note: "Slow down slightly and compare character by character." };
  return { label: "Keep practising", note: "Read each code in small chunks (e.g. 3–4 characters) and compare." };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
