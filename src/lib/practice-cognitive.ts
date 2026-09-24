/**
 * Cognitive ability practice: numerical reasoning, problem solving & logic, and attention to detail.
 * Every question is generated from a template with random values, so no two attempts are the same.
 * Answers are computed, never typed in by hand, and every question has exactly one correct option.
 */
import { fabCode, int, mutate, pick, shuffle, type Rng } from "@/lib/practice";
import { pickFresh, type QuizQuestion, type Visual } from "@/lib/quiz";

export const SECTIONS = { num: "Numerical reasoning", logic: "Problem solving & logic", detail: "Attention to detail" } as const;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const n = (x: number) => nf.format(Math.round(x * 100) / 100);
const money = (x: number) => `$${(Math.round(x * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (x: number) => `${n(x)}%`;

/** Build a question with the correct answer plus 3 distinct distractors, in random order. */
function mcq(
  rng: Rng,
  q: { id: string; section: string; prompt: string; correct: string; distractors: string[]; explanation: string; visual?: Visual; mono?: boolean; count?: number },
): QuizQuestion {
  const want = (q.count ?? 4) - 1;
  const seen = new Set([q.correct]);
  const wrong: string[] = [];
  for (const d of q.distractors) {
    if (!seen.has(d) && wrong.length < want) {
      seen.add(d);
      wrong.push(d);
    }
  }
  if (wrong.length < want) throw new Error(`Not enough distractors for ${q.id}`);
  const options = shuffle(rng, [q.correct, ...wrong]);
  return {
    id: q.id,
    section: q.section,
    prompt: q.prompt,
    visual: q.visual,
    options: options.map((text) => ({ text })),
    answer: options.indexOf(q.correct),
    explanation: q.explanation,
    monoOptions: q.mono,
  };
}

/** Numeric distractors near the answer (common slips), always distinct from it and positive. */
function near(answer: number, fmt: (x: number) => string, extra: number[] = []): string[] {
  const steps = [0.1, 10, 1.1, 0.9, 1.2, 0.8, 1.25, 0.75, 1.5, 0.5, 2];
  const candidates = [...extra, ...steps.map((m) => answer * m), answer + 1, answer - 1, answer + 2];
  return candidates.filter((x) => x > 0 && Number.isFinite(x)).map((x) => fmt(x)).filter((s) => s !== fmt(answer));
}

type Template = { id: string; section: string; make: (rng: Rng) => QuizQuestion };

// ---------------------------------------------------------------------------
// Numerical reasoning
// ---------------------------------------------------------------------------

const NUMERICAL: Template[] = [
  {
    id: "num-defects",
    section: SECTIONS.num,
    make: (rng) => {
      const p = pick(rng, [2, 3, 4, 5, 6, 8, 12, 15]);
      const lot = pick(rng, [200, 300, 400, 500, 600, 800, 1200]);
      const ans = (lot * p) / 100;
      return mcq(rng, {
        id: "num-defects",
        section: SECTIONS.num,
        prompt: `A batch of ${n(lot)} wafers has a defect rate of ${p}%. How many wafers are defective?`,
        correct: n(ans),
        distractors: near(ans, n, [lot * p / 1000, lot - ans]),
        explanation: `${p}% of ${n(lot)} = ${n(lot)} × ${p} ÷ 100 = ${n(ans)} wafers.`,
      });
    },
  },
  {
    id: "num-increase",
    section: SECTIONS.num,
    make: (rng) => {
      let a = 0;
      let b = 0;
      let p = 0;
      do {
        a = pick(rng, [80, 120, 160, 200, 240, 250, 300, 400, 500]);
        p = pick(rng, [5, 10, 12.5, 15, 20, 25, 30, 40, 50]);
        b = a * (1 + p / 100);
      } while (!Number.isInteger(b));
      const wrongBase = ((b - a) / b) * 100;
      return mcq(rng, {
        id: "num-increase",
        section: SECTIONS.num,
        prompt: `Weekly output on a line rose from ${n(a)} to ${n(b)} units. What was the percentage increase?`,
        correct: pct(p),
        distractors: [pct(Math.round(wrongBase * 10) / 10), pct(b - a), pct(p + 5), pct(p * 2), pct(Math.max(1, p - 5))],
        explanation: `Increase = ${n(b)} − ${n(a)} = ${n(b - a)}. Divide by the original: ${n(b - a)} ÷ ${n(a)} = ${pct(p)}. (Dividing by the new value is a common mistake.)`,
      });
    },
  },
  {
    id: "num-utilization",
    section: SECTIONS.num,
    make: (rng) => {
      const shift = pick(rng, [8, 10, 12]);
      let u = 0;
      let run = 0;
      do {
        u = pick(rng, [50, 60, 65, 70, 75, 80, 85, 90, 95]);
        run = (shift * u) / 100;
      } while (Math.round(run * 10) !== run * 10);
      return mcq(rng, {
        id: "num-utilization",
        section: SECTIONS.num,
        prompt: `A tool was running for ${n(run)} hours of a ${shift}-hour shift. What was its utilization?`,
        correct: pct(u),
        distractors: [pct(100 - u), pct(u + 5), pct(Math.max(5, u - 10)), pct(run * 10), pct(u + 10)],
        explanation: `Utilization = running time ÷ available time = ${n(run)} ÷ ${shift} = ${pct(u)}.`,
      });
    },
  },
  {
    id: "num-ratio",
    section: SECTIONS.num,
    make: (rng) => {
      const [w, c] = pick(rng, [
        [3, 1],
        [4, 1],
        [5, 1],
        [2, 1],
        [3, 2],
        [7, 3],
        [9, 1],
      ] as const);
      const total = (w + c) * pick(rng, [2, 3, 4, 5, 6]);
      const ans = (total * c) / (w + c);
      return mcq(rng, {
        id: "num-ratio",
        section: SECTIONS.num,
        prompt: `A cleaning solution is mixed as water to concentrate in the ratio ${w}:${c}. How many litres of concentrate are needed to make ${total} litres of solution?`,
        correct: `${n(ans)} L`,
        distractors: [`${n((total * w) / (w + c))} L`, `${n(total / c)} L`, `${n(total / w)} L`, `${n(ans + c)} L`, `${n(ans * 2)} L`],
        explanation: `The ratio has ${w} + ${c} = ${w + c} parts, and concentrate is ${c} of them: ${total} × ${c}/${w + c} = ${n(ans)} L.`,
      });
    },
  },
  {
    id: "num-fraction",
    section: SECTIONS.num,
    make: (rng) => {
      const [num, den] = pick(rng, [
        [3, 4],
        [2, 3],
        [4, 5],
        [5, 6],
        [7, 8],
        [9, 10],
      ] as const);
      const total = den * pick(rng, [6, 8, 10, 12, 15, 20]);
      const passed = (total * num) / den;
      const failed = total - passed;
      return mcq(rng, {
        id: "num-fraction",
        section: SECTIONS.num,
        prompt: `${num}/${den} of the ${total} parts inspected today passed. How many parts failed?`,
        correct: n(failed),
        distractors: [n(passed), n(total / den), n(failed + den), n(failed * 2), n(Math.max(1, failed - num))],
        explanation: `Passed = ${total} × ${num}/${den} = ${n(passed)}, so failed = ${total} − ${n(passed)} = ${n(failed)}.`,
      });
    },
  },
  {
    id: "num-cost",
    section: SECTIONS.num,
    make: (rng) => {
      const price = pick(rng, [8.4, 12.5, 18, 24.75, 36, 42.5]);
      const qty = pick(rng, [40, 50, 80, 120, 200]);
      const d = pick(rng, [5, 10, 15, 20]);
      const gross = price * qty;
      const ans = gross * (1 - d / 100);
      return mcq(rng, {
        id: "num-cost",
        section: SECTIONS.num,
        prompt: `Replacement O-rings cost ${money(price)} each. The supplier gives a ${d}% discount on orders of ${qty} or more. What is the total cost of ${qty} O-rings?`,
        correct: money(ans),
        distractors: [money(gross), money((gross * d) / 100), money(gross - d), money(ans * 0.9), money(gross * (1 + d / 100))],
        explanation: `${qty} × ${money(price)} = ${money(gross)}. A ${d}% discount leaves ${100 - d}%: ${money(gross)} × ${(100 - d) / 100} = ${money(ans)}.`,
      });
    },
  },
  {
    id: "num-rate",
    section: SECTIONS.num,
    make: (rng) => {
      const r = pick(rng, [40, 60, 80, 90, 120, 150]);
      const t = pick(rng, [2.5, 3, 3.5, 4, 4.5, 6, 7.5]);
      const parts = r * t;
      const hm = (h: number) => {
        const hh = Math.floor(h);
        const mm = Math.round((h - hh) * 60);
        return mm ? `${hh} h ${mm} min` : `${hh} h`;
      };
      return mcq(rng, {
        id: "num-rate",
        section: SECTIONS.num,
        prompt: `A machine makes ${r} parts per hour. How long will it take to make ${n(parts)} parts?`,
        correct: hm(t),
        // "2.5 h = 2 h 50 min" is a classic slip, so offer it when the time isn't whole hours.
        distractors: [...(t % 1 ? [`${Math.floor(t)} h ${Math.round((t % 1) * 100)} min`] : []), hm(t + 0.5), hm(Math.max(0.5, t - 0.5)), hm(t + 1), hm(t * 2)],
        explanation: `Time = parts ÷ rate = ${n(parts)} ÷ ${r} = ${t} hours = ${hm(t)}.`,
      });
    },
  },
  {
    id: "num-yield",
    section: SECTIONS.num,
    make: (rng) => {
      let planned = 0;
      let y = 0;
      let good = 0.5;
      while (!Number.isInteger(good)) {
        planned = pick(rng, [200, 250, 400, 500, 800]);
        y = pick(rng, [72, 76, 80, 84, 85, 88, 90, 92, 95, 96]);
        good = (planned * y) / 100;
      }
      return mcq(rng, {
        id: "num-yield",
        section: SECTIONS.num,
        prompt: `A shift started ${planned} units and ${n(good)} of them passed final test. What was the yield?`,
        correct: pct(y),
        distractors: [pct(100 - y), pct(y + 4), pct(Math.max(1, y - 6)), pct(Math.round((planned / good) * 1000) / 10), pct(y + 8)],
        explanation: `Yield = good units ÷ units started = ${n(good)} ÷ ${planned} = ${pct(y)}.`,
      });
    },
  },
  {
    id: "num-convert",
    section: SECTIONS.num,
    make: (rng) => {
      const [label, value] = pick(rng, [
        ["1/4", 0.25],
        ["3/8", 0.375],
        ["1/2", 0.5],
        ["5/8", 0.625],
        ["3/4", 0.75],
        ["1/8", 0.125],
      ] as const);
      const mm = value * 25.4;
      return mcq(rng, {
        id: "num-convert",
        section: SECTIONS.num,
        prompt: `A fitting is ${label} inch wide. What is that in millimetres? (1 inch = 25.4 mm)`,
        correct: `${n(mm)} mm`,
        distractors: [`${n(value * 2.54)} mm`, `${n(mm * 2)} mm`, `${n(value / 25.4)} mm`, `${n(mm + 2.54)} mm`, `${n(25.4 / value)} mm`],
        explanation: `${label} = ${value}. ${value} × 25.4 = ${n(mm)} mm.`,
      });
    },
  },
  {
    id: "num-table-rate",
    section: SECTIONS.num,
    make: (rng) => {
      const names = shuffle(rng, ["ETCH-01", "ETCH-02", "DEP-07", "CMP-03", "LITH-05", "IMP-02"]).slice(0, 4);
      const rates = shuffle(rng, [18, 21, 24, 26, 29, 32]).slice(0, 4);
      const hours = names.map(() => int(rng, 6, 11));
      const wafers = rates.map((r, i) => r * hours[i]);
      const best = rates.indexOf(Math.max(...rates));
      const mostWafers = wafers.indexOf(Math.max(...wafers));
      return mcq(rng, {
        id: "num-table-rate",
        section: SECTIONS.num,
        prompt: "Which tool processed the most wafers per running hour?",
        visual: { type: "table", caption: "Yesterday's tool report", headers: ["Tool", "Wafers processed", "Hours running"], rows: names.map((t, i) => [t, wafers[i], hours[i]]) },
        correct: names[best],
        distractors: [...(mostWafers !== best ? [names[mostWafers]] : []), ...names.filter((_, i) => i !== best)],
        mono: true,
        explanation: `Divide wafers by hours: ${names.map((t, i) => `${t} ${wafers[i]}÷${hours[i]} = ${rates[i]}`).join("; ")}. ${names[best]} has the highest rate${mostWafers !== best ? ` even though ${names[mostWafers]} processed more wafers in total` : ""}.`,
      });
    },
  },
  {
    id: "num-chart-average",
    section: SECTIONS.num,
    make: (rng) => {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      let values: number[] = [];
      do values = days.map(() => int(rng, 3, 18));
      while (values.reduce((a, b) => a + b, 0) % 5 !== 0);
      const avg = values.reduce((a, b) => a + b, 0) / 5;
      const range = Math.max(...values) - Math.min(...values);
      const askRange = rng() < 0.5;
      const sum = values.reduce((a, b) => a + b, 0);
      return mcq(rng, {
        id: "num-chart-average",
        section: SECTIONS.num,
        prompt: askRange
          ? "How many more defects were found on the worst day than on the best day?"
          : "What was the average number of defects found per day?",
        visual: { type: "bars", title: "Defects found per day", unit: "", data: days.map((d, i) => ({ label: d, value: values[i] })) },
        correct: n(askRange ? range : avg),
        distractors: askRange
          ? near(range, n, [Math.max(...values), Math.min(...values), avg])
          : near(avg, n, [sum, Math.max(...values), values[2], (Math.max(...values) + Math.min(...values)) / 2]),
        explanation: askRange
          ? `Highest ${Math.max(...values)} − lowest ${Math.min(...values)} = ${range}.`
          : `Total ${values.join(" + ")} = ${sum}. ${sum} ÷ 5 days = ${n(avg)}.`,
      });
    },
  },
];

// ---------------------------------------------------------------------------
// Problem solving & logic
// ---------------------------------------------------------------------------

const TASKS = ["Pump check", "Leak test", "Gauge calibration", "Chamber clean", "Filter change", "Log review"];
const PEOPLE = ["Ana", "Ben", "Chen", "Dee", "Eli", "Faye", "Gus", "Hana", "Ivan", "Jo", "Kai", "Luz"];

type Constraint = { text: string; ok: (order: string[]) => boolean };

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]));
}

const LOGIC: Template[] = [
  {
    id: "logic-sequence",
    section: SECTIONS.logic,
    make: (rng) => {
      const kind = int(rng, 0, 3);
      let seq: number[] = [];
      let rule = "";
      if (kind === 0) {
        const a = int(rng, 2, 30);
        const d = int(rng, 3, 12);
        seq = Array.from({ length: 6 }, (_, i) => a + d * i);
        rule = `add ${d} each time`;
      } else if (kind === 1) {
        const a = int(rng, 2, 6);
        const r = pick(rng, [2, 3]);
        seq = Array.from({ length: 6 }, (_, i) => a * r ** i);
        rule = `multiply by ${r} each time`;
      } else if (kind === 2) {
        const a = int(rng, 1, 10);
        const d = int(rng, 1, 3);
        seq = [a];
        for (let i = 1; i < 6; i++) seq.push(seq[i - 1] + d * i);
        rule = `the gap grows by ${d} each time (+${d}, +${2 * d}, +${3 * d}…)`;
      } else {
        const a = int(rng, 10, 40);
        const up = int(rng, 5, 9);
        const down = int(rng, 2, 4);
        seq = [a];
        for (let i = 1; i < 6; i++) seq.push(seq[i - 1] + (i % 2 ? up : -down));
        rule = `alternate +${up} and −${down}`;
      }
      const ans = seq[5];
      return mcq(rng, {
        id: "logic-sequence",
        section: SECTIONS.logic,
        prompt: `What number comes next? ${seq.slice(0, 5).join(", ")}, ?`,
        correct: n(ans),
        distractors: [n(ans + 1), n(ans - 1), n(seq[4] + (seq[4] - seq[3])), n(ans + (seq[1] - seq[0])), n(ans * 2), n(ans + 2)],
        explanation: `The pattern is: ${rule}. So the next number is ${ans}.`,
      });
    },
  },
  {
    id: "logic-code-sequence",
    section: SECTIONS.logic,
    make: (rng) => {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const ls = int(rng, 1, 3);
      const ns = int(rng, 2, 5);
      const l0 = int(rng, 0, 5);
      const n0 = int(rng, 1, 9);
      const term = (i: number) => `${letters[l0 + ls * i]}${n0 + ns * i}`;
      const ans = term(4);
      return mcq(rng, {
        id: "logic-code-sequence",
        section: SECTIONS.logic,
        prompt: `Bins are labelled in a pattern: ${[0, 1, 2, 3].map(term).join(", ")}, ?  What is the next label?`,
        correct: ans,
        distractors: [
          `${letters[l0 + ls * 4 + 1]}${n0 + ns * 4}`,
          `${letters[l0 + ls * 4]}${n0 + ns * 4 + 1}`,
          `${letters[l0 + ls * 3 + 1]}${n0 + ns * 4}`,
          `${letters[l0 + ls * 4]}${n0 + ns * 3 + 1}`,
          `${letters[l0 + ls * 4 - 1]}${n0 + ns * 4 - 1}`,
        ],
        mono: true,
        explanation: `Letters move forward ${ls} each time and numbers go up by ${ns}: ${ans}.`,
      });
    },
  },
  {
    id: "logic-if-then",
    section: SECTIONS.logic,
    make: (rng) => {
      const [sensor, unit, alarm] = pick(rng, [
        ["chamber pressure", "mTorr", "pump alarm"],
        ["coolant temperature", "°C", "over-temp light"],
        ["gas flow", "sccm", "flow alert"],
        ["exhaust pressure", "Pa", "exhaust warning"],
      ] as const);
      const limit = int(rng, 10, 80);
      const variant = int(rng, 0, 2);
      const rule = `Rule: if the ${sensor} goes above ${limit} ${unit}, the ${alarm} always turns on.`;
      if (variant === 0) {
        return mcq(rng, {
          id: "logic-if-then",
          section: SECTIONS.logic,
          prompt: `${rule} This morning the ${alarm} stayed off all shift. What must be true?`,
          correct: `The ${sensor} never went above ${limit} ${unit}.`,
          distractors: [`The ${sensor} went above ${limit} ${unit}.`, `The ${alarm} is broken.`, `The ${sensor} stayed at exactly ${limit} ${unit}.`, `The tool was switched off.`],
          explanation: `If going above ${limit} always turns the ${alarm} on, then an alarm that stayed off means the reading never went above ${limit}.`,
        });
      }
      if (variant === 1) {
        const reading = limit + int(rng, 2, 15);
        return mcq(rng, {
          id: "logic-if-then",
          section: SECTIONS.logic,
          prompt: `${rule} At 10:15 the ${sensor} read ${reading} ${unit}. What must be true?`,
          correct: `The ${alarm} turned on.`,
          distractors: [`The ${alarm} stayed off.`, `It can't be determined.`, `The ${sensor} reading is wrong.`, `The ${alarm} turned on only if a technician was present.`],
          explanation: `${reading} is above ${limit}, and the rule says that always turns the ${alarm} on.`,
        });
      }
      return mcq(rng, {
        id: "logic-if-then",
        section: SECTIONS.logic,
        prompt: `${rule} The ${alarm} is on right now. What can you conclude for certain?`,
        correct: `Nothing certain about the ${sensor}; the ${alarm} may have another cause.`,
        distractors: [`The ${sensor} is above ${limit} ${unit}.`, `The ${sensor} is below ${limit} ${unit}.`, `The ${alarm} is faulty.`, `The ${sensor} is exactly ${limit} ${unit}.`],
        explanation: `The rule only says what happens when the reading is high. It doesn't say the ${alarm} can only turn on for that reason, so you can't be certain. Check the reading.`,
      });
    },
  },
  {
    id: "logic-syllogism",
    section: SECTIONS.logic,
    make: (rng) => {
      const [a, b, c] = pick(rng, [
        ["torque wrenches in Bay 3", "calibrated tools", "tools tagged for repair"],
        ["wafers in lot 42", "inspected wafers", "wafers on hold"],
        ["technicians on B shift", "people trained on the etch tool", "people allowed to skip the safety brief"],
        ["parts in bin 7", "stainless steel parts", "parts that need painting"],
        ["gloves in this box", "ESD-safe gloves", "gloves approved for chemical handling"],
        ["pumps on line 2", "pumps serviced this month", "pumps due for an overhaul"],
      ] as const);
      const allNo = rng() < 0.5;
      if (allNo) {
        return mcq(rng, {
          id: "logic-syllogism",
          section: SECTIONS.logic,
          prompt: `All ${a} are ${b}. No ${b} are ${c}. Which statement must be true?`,
          correct: `No ${a} are ${c}.`,
          distractors: [`Some ${a} are ${c}.`, `All ${c} are ${a}.`, `All ${b} are ${a}.`, `Some ${c} are ${b}.`],
          explanation: `Every one of the ${a} is among the ${b}, and none of the ${b} are ${c}. So none of the ${a} can be ${c}.`,
        });
      }
      return mcq(rng, {
        id: "logic-syllogism",
        section: SECTIONS.logic,
        prompt: `All ${a} are ${b}. Some ${a} are ${c}. Which statement must be true?`,
        correct: `Some ${b} are ${c}.`,
        distractors: [`All ${b} are ${c}.`, `All ${c} are ${a}.`, `No ${b} are ${c}.`, `All ${a} are ${c}.`],
        explanation: `The ${a} that are ${c} are also among the ${b} (because all ${a} are ${b}). So at least some ${b} are ${c}. Nothing says it's all of them.`,
      });
    },
  },
  {
    id: "logic-ordering",
    section: SECTIONS.logic,
    make: (rng) => {
      const tasks = shuffle(rng, TASKS).slice(0, 4);
      const order = shuffle(rng, tasks);
      const [i, j] = shuffle(rng, [0, 1, 2, 3]).slice(0, 2).sort();
      const k = int(rng, 0, 2);
      const constraints: Constraint[] = [
        { text: `${order[i]} must happen before ${order[j]}.`, ok: (o) => o.indexOf(order[i]) < o.indexOf(order[j]) },
        { text: `${order[k + 1]} must happen immediately after ${order[k]}.`, ok: (o) => o.indexOf(order[k + 1]) === o.indexOf(order[k]) + 1 },
        rng() < 0.5
          ? { text: `${order[3]} must be done last.`, ok: (o) => o[3] === order[3] }
          : { text: `${order[0]} must be done first.`, ok: (o) => o[0] === order[0] },
      ];
      const valid = permutations(tasks).filter((p) => constraints.every((c) => c.ok(p)));
      if (valid.length !== 1) return LOGIC[4].make(rng); // regenerate until the rules pin down one order
      const wrong = shuffle(rng, permutations(tasks).filter((p) => !constraints.every((c) => c.ok(p)))).slice(0, 3);
      return mcq(rng, {
        id: "logic-ordering",
        section: SECTIONS.logic,
        prompt: "The maintenance tasks below must follow these rules. Which order follows ALL of them?",
        visual: { type: "list", items: constraints.map((c) => c.text) },
        correct: order.join(" → "),
        distractors: wrong.map((p) => p.join(" → ")),
        explanation: `Only ${order.join(" → ")} satisfies every rule. Check each option against each rule in turn and eliminate any that break one.`,
      });
    },
  },
  {
    id: "logic-compliance",
    section: SECTIONS.logic,
    make: (rng) => {
      const limit = pick(rng, [25, 50, 100]);
      const lots = shuffle(rng, ["AZ-1042", "AZ-1187", "AZ-2230", "AZ-3015", "AZ-3391", "AZ-4408"]).slice(0, 4);
      // One lot passes; each other lot breaks exactly one different rule. Sign-off is only needed for big lots.
      const size = (big: boolean) => (big ? limit + int(rng, 3, 40) : int(rng, Math.round(limit / 2), limit));
      const signoffFor = (wafers: number) => (wafers > limit ? "Yes" : "Not needed");
      const lotRow = (inspection: string, inSpec: string, wafers: number, signoff = signoffFor(wafers)) => ({ inspection, inSpec, size: wafers, signoff });
      const goodSize = size(rng() < 0.5);
      const rowsRaw = [
        { pass: true, ...lotRow("Pass", "Yes", goodSize) },
        { pass: false, ...lotRow("Fail", "Yes", size(rng() < 0.5)) },
        { pass: false, ...lotRow("Pass", "No", size(rng() < 0.5)) },
        { pass: false, ...lotRow("Pass", "Yes", size(true), "No") },
      ];
      const rows = shuffle(rng, rowsRaw).map((r, i) => ({ ...r, lot: lots[i] }));
      const passLot = rows.find((r) => r.pass)!.lot;
      return mcq(rng, {
        id: "logic-compliance",
        section: SECTIONS.logic,
        prompt: `Release rule: a lot can ship only if (1) inspection is Pass, (2) all test wafers are in spec, and (3) any lot over ${limit} wafers has a supervisor sign-off. Which lot can ship?`,
        visual: {
          type: "table",
          headers: ["Lot", "Wafers", "Inspection", "Test wafers in spec", "Supervisor sign-off"],
          rows: rows.map((r) => [r.lot, r.size, r.inspection, r.inSpec, r.signoff]),
        },
        correct: passLot,
        distractors: rows.map((r) => r.lot).filter((l) => l !== passLot),
        mono: true,
        explanation: `${passLot} meets all three rules. Each other lot breaks one: a failed inspection, a test wafer out of spec, or a missing sign-off on a lot over ${limit} wafers.`,
      });
    },
  },
  {
    id: "logic-shifts",
    section: SECTIONS.logic,
    make: (rng) => {
      const people = shuffle(rng, PEOPLE).slice(0, 3);
      const shifts = ["day", "swing", "night"];
      const truth = shuffle(rng, people); // truth[i] works shifts[i]
      const shiftOf = (p: string, o: string[]) => shifts[o.indexOf(p)];
      const clues: Constraint[] = [];
      const pool: Constraint[] = [
        ...people.flatMap((p) =>
          shifts.filter((s) => s !== shiftOf(p, truth)).map((s) => ({ text: `${p} does not work the ${s} shift.`, ok: (o: string[]) => shiftOf(p, o) !== s })),
        ),
        ...[0, 1].map((i) => ({
          text: `${truth[i + 1]} works the shift right after ${truth[i]}'s.`,
          ok: (o: string[]) => o.indexOf(truth[i + 1]) === o.indexOf(truth[i]) + 1,
        })),
      ];
      for (const c of shuffle(rng, pool)) {
        clues.push(c);
        if (permutations(people).filter((p) => clues.every((x) => x.ok(p))).length === 1) break;
      }
      const target = pick(rng, shifts);
      const who = truth[shifts.indexOf(target)];
      return mcq(rng, {
        id: "logic-shifts",
        section: SECTIONS.logic,
        prompt: `${people.join(", ")} each work a different shift (day → swing → night). Using the clues, who works the ${target} shift?`,
        visual: { type: "list", items: clues.map((c) => c.text) },
        correct: who,
        distractors: [...people.filter((p) => p !== who), "It can't be determined"],
        count: 4,
        explanation: `The only arrangement that fits every clue is: ${truth.map((p, i) => `${p} ${shifts[i]}`).join(", ")}. So ${who} works ${target}.`,
      });
    },
  },
];

// ---------------------------------------------------------------------------
// Attention to detail
// ---------------------------------------------------------------------------

const DETAIL: Template[] = [
  {
    id: "detail-compare",
    section: SECTIONS.detail,
    make: (rng) => {
      const { kind, value } = fabCode(rng);
      const same = rng() < 0.45;
      const right = same ? value : mutate(rng, value);
      return mcq(rng, {
        id: "detail-compare",
        section: SECTIONS.detail,
        prompt: `${kind}: are these two exactly the same?`,
        visual: { type: "pair", left: value, right },
        correct: same ? "Same" : "Different",
        distractors: [same ? "Different" : "Same"],
        count: 2,
        explanation: same ? "Every character matches." : `They differ: ${value} vs ${right}. Compare in small chunks of 3–4 characters.`,
      });
    },
  },
  {
    id: "detail-match",
    section: SECTIONS.detail,
    make: (rng) => {
      const { kind, value } = fabCode(rng);
      const decoys = new Set<string>();
      while (decoys.size < 3) decoys.add(mutate(rng, value));
      return mcq(rng, {
        id: "detail-match",
        section: SECTIONS.detail,
        prompt: `${kind}: which option is an exact copy of the target?`,
        visual: { type: "target", value },
        correct: value,
        distractors: [...decoys],
        mono: true,
        explanation: `Only ${value} matches exactly. The others each have one small change.`,
      });
    },
  },
  {
    id: "detail-count",
    section: SECTIONS.detail,
    make: (rng) => {
      const { value } = fabCode(rng);
      const k = int(rng, 2, 4);
      const others = Array.from({ length: 10 - k }, () => mutate(rng, value));
      const items = shuffle(rng, [...Array.from({ length: k }, () => value), ...others]);
      return mcq(rng, {
        id: "detail-count",
        section: SECTIONS.detail,
        prompt: `How many times does exactly "${value}" appear in this list?`,
        visual: { type: "list", items, mono: true },
        correct: String(k),
        distractors: [String(k + 1), String(k - 1), String(k + 2), String(k + 3)].filter((x) => Number(x) > 0),
        explanation: `It appears ${k} times. The other entries are look-alikes with one character changed.`,
      });
    },
  },
  {
    id: "detail-anomaly",
    section: SECTIONS.detail,
    make: (rng) => {
      const start = int(rng, 10, 60);
      const step = pick(rng, [5, 10, 15, 20, 25]);
      const readings = Array.from({ length: 6 }, (_, i) => start + step * i);
      const bad = int(rng, 1, 5);
      const correct = readings[bad];
      const s = String(correct);
      // A realistic slip: two digits swapped, or one digit off.
      let wrong = s.length > 1 && s[0] !== s[1] ? s[1] + s[0] + s.slice(2) : String(correct + pick(rng, [1, -1, 2]));
      if (Number(wrong) === correct) wrong = String(correct + 1);
      const shown = readings.map((r, i) => (i === bad ? Number(wrong) : r));
      const labels = shown.map((_, i) => `Reading ${i + 1}`);
      const optionIdx = shuffle(rng, [...shuffle(rng, [0, 1, 2, 3, 4, 5].filter((i) => i !== bad)).slice(0, 3), bad]);
      return mcq(rng, {
        id: "detail-anomaly",
        section: SECTIONS.detail,
        prompt: `These gauge readings should rise by exactly ${step} each step. Which one was recorded wrong?`,
        visual: { type: "list", items: shown.map((r) => `${r} psi`), mono: true },
        correct: labels[bad],
        distractors: optionIdx.filter((i) => i !== bad).map((i) => labels[i]),
        explanation: `Reading ${bad + 1} should be ${correct} psi but was recorded as ${wrong} psi.`,
      });
    },
  },
  {
    id: "detail-instruction",
    section: SECTIONS.detail,
    make: (rng) => {
      const limit = pick(rng, [40, 50, 60, 75]);
      let values: number[] = [];
      do values = Array.from({ length: 8 }, () => int(rng, limit - 25, limit + 25));
      while (values.filter((v) => v > limit).length < 3 || values.includes(limit));
      const above = values.filter((v) => v > limit);
      const nth = pick(rng, [2, 3] as const);
      const ans = above[nth - 1];
      return mcq(rng, {
        id: "detail-instruction",
        section: SECTIONS.detail,
        prompt: `Checklist step 4: "Record the ${nth === 2 ? "SECOND" : "THIRD"} reading in the list that is ABOVE ${limit} °C." Which value do you record?`,
        visual: { type: "list", items: values.map((v) => `${v} °C`), mono: true },
        correct: `${ans} °C`,
        distractors: [
          `${above[0]} °C`,
          `${above[nth] ?? Math.max(...values)} °C`,
          `${Math.max(...values)} °C`,
          `${values[nth - 1]} °C`,
          `${values[nth]} °C`,
          ...values.map((v) => `${v} °C`),
          `${limit} °C`,
          `${ans + 1} °C`,
        ],
        explanation: `Readings above ${limit}: ${above.join(", ")}. The ${nth === 2 ? "second" : "third"} one is ${ans} °C.`,
      });
    },
  },
];

export const COGNITIVE_TEMPLATES = { num: NUMERICAL, logic: LOGIC, detail: DETAIL };

/**
 * A fresh cognitive assessment: 6 numerical, 6 logic, 6 attention-to-detail questions.
 * Templates used in the previous attempt are placed last so each round feels different;
 * all values are random so questions never repeat exactly.
 */
export function cognitiveQuiz(rng: Rng, recent: readonly string[] = [], perSection = 6): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const templates of [NUMERICAL, LOGIC, DETAIL]) {
    const chosen: Template[] = [];
    // Use as many distinct templates as possible, then top up (detail-compare/match repeat well).
    const fresh = pickFresh(rng, templates, templates.length, recent);
    for (let i = 0; chosen.length < perSection; i++) chosen.push(fresh[i % fresh.length]);
    for (const t of chosen) out.push(t.make(rng));
  }
  return out;
}

export function cognitiveLevel(pct: number): { label: string; note: string } {
  if (pct >= 90) return { label: "Excellent", note: "Very strong reasoning. Keep your speed up and you'll be well prepared." };
  if (pct >= 75) return { label: "Strong", note: "Good work. Review the explanations for the ones you missed; patterns repeat." };
  if (pct >= 55) return { label: "Developing", note: "You're getting there. Slow down on multi-step questions and write down intermediate numbers." };
  return { label: "Keep practising", note: "Focus on one section at a time. Read every question twice, and use the explanations to learn the method." };
}
