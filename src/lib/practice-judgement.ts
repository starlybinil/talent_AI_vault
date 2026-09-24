/**
 * Situational judgement practice: realistic workplace scenarios for a technician in a fab or advanced
 * manufacturing plant. Each response is scored 0–3 (3 = most effective). Names and details are filled in
 * at random and options shuffle, so repeat scenarios still read differently.
 */
import { pick, shuffle, type Rng } from "@/lib/practice";
import { pickFresh, type QuizQuestion } from "@/lib/quiz";

export const COMPETENCIES = {
  safety: "Safety first",
  quality: "Quality & integrity",
  team: "Teamwork & respect",
  comms: "Communication",
  reliable: "Reliability & ownership",
  learning: "Learning & judgement",
} as const;

type Scenario = {
  id: string;
  competency: keyof typeof COMPETENCIES;
  text: string;
  options: Array<[score: 0 | 1 | 2 | 3, text: string]>;
  why: string;
};

const COWORKERS = ["Jordan", "Maria", "Dev", "Aisha", "Tom", "Lina", "Marcus", "Priya", "Sam", "Rosa", "Kenji", "Tasha"];
const SUPERVISORS = ["Ms. Alvarez", "Mr. Chen", "Ms. Okafor", "Mr. Patel", "Ms. Nguyen", "Mr. Johnson"];
const TOOLS = ["etch tool", "deposition chamber", "wafer cleaner", "vacuum pump skid", "inspection station", "robot handler"];

const SCENARIOS: Scenario[] = [
  {
    id: "sjt-spill",
    competency: "safety",
    text: "You notice a small puddle of clear liquid on the floor next to a chemical wet bench. Nobody else is around.",
    options: [
      [3, "Keep people away from the area and report it right away using the spill procedure, so trained staff can identify and clean it."],
      [2, "Put a caution sign next to it, finish your task, and mention it at the end of the shift."],
      [1, "Wipe it up with paper towels; it's probably just water."],
      [0, "Leave it. Whoever is assigned to that bench will deal with it."],
    ],
    why: "In a fab, a clear liquid could be a hazardous chemical. Secure the area and report immediately; never guess or clean up an unknown spill yourself.",
  },
  {
    id: "sjt-gowning",
    competency: "safety",
    text: "You're running 10 minutes late for a cleanroom task. {coworker} says you can skip the hood and face mask because you'll only be inside for a couple of minutes.",
    options: [
      [3, "Gown fully by the procedure, and let {supervisor} know you're running a few minutes behind."],
      [2, "Gown fully, but don't tell anyone that you'll be late."],
      [1, "Wear the mask but skip the hood to save a minute."],
      [0, "Skip the hood and mask this once, since it's quick."],
    ],
    why: "Gowning protects the product and the people. Shortcuts are never acceptable, and it's better to communicate that you're late than to cut corners.",
  },
  {
    id: "sjt-lockout",
    competency: "safety",
    text: "You're about to replace a part inside the {tool}. {coworker} says the tool is already switched off, so you don't need to do lockout/tagout.",
    options: [
      [3, "Apply your own lock and tag, then verify there's no energy before you start."],
      [2, "Ask {coworker} to stand next to the power switch while you work."],
      [1, "Use {coworker}'s lock that is already on the tool and start."],
      [0, "Start the job, since the tool is off."],
    ],
    why: "Every person working on equipment applies their own lock and verifies zero energy. 'It's already off' is exactly how serious injuries happen.",
  },
  {
    id: "sjt-glove",
    competency: "safety",
    text: "While handling a chemical container you notice a small tear in your glove.",
    options: [
      [3, "Stop, remove the glove carefully, wash your hands, put on a new pair, and report it as the procedure requires."],
      [2, "Replace the glove straight away but don't report it."],
      [1, "Put a second glove on over the torn one and carry on."],
      [0, "Finish the task first; it will only take a minute."],
    ],
    why: "Chemical exposure can happen through a tiny tear. Stop, decontaminate, replace, and report so the cause (bad batch of gloves?) can be checked.",
  },
  {
    id: "sjt-alarm",
    competency: "safety",
    text: "An alarm you've never seen before appears on the {tool} you are running.",
    options: [
      [3, "Stop and follow the alarm response guide, or call the equipment engineer or {supervisor} before doing anything else."],
      [2, "Ask the nearest coworker what it means and do what they suggest."],
      [1, "Search the alarm code online and try the first fix you find."],
      [0, "Reset the alarm and keep running."],
    ],
    why: "Unknown alarms can signal a safety or product risk. Use the approved response or get an expert. Resetting without understanding can scrap wafers or hurt someone.",
  },
  {
    id: "sjt-lot-number",
    competency: "quality",
    text: "An hour ago you logged the wrong lot number for a wafer run. Nobody has noticed.",
    options: [
      [3, "Tell your lead now and correct the record following the correction procedure."],
      [2, "Mention it in your end-of-shift report."],
      [1, "Quietly fix the entry yourself without telling anyone."],
      [0, "Leave it; it's only one entry."],
    ],
    why: "Traceability depends on accurate records. Owning a mistake quickly, and correcting it the approved way, stops it from spreading to other steps.",
  },
  {
    id: "sjt-out-of-spec",
    competency: "quality",
    text: "A pressure reading is slightly out of spec. {coworker} says to just write down an in-spec number because it's 'close enough'.",
    options: [
      [3, "Record the actual value and report it following the out-of-spec procedure."],
      [2, "Record the actual value but don't flag it to anyone."],
      [1, "Leave the field blank and move on."],
      [0, "Write down an in-spec number as {coworker} suggested."],
    ],
    why: "Falsifying data is never acceptable, even for small differences. Engineers rely on true readings to catch problems early.",
  },
  {
    id: "sjt-shortcut",
    competency: "quality",
    text: "{coworker} shows you a faster way to do a maintenance task. It skips one step in the written procedure.",
    options: [
      [3, "Keep following the written procedure, and suggest the idea to {supervisor} or the engineer so it can be reviewed properly."],
      [2, "Follow the procedure but keep the idea to yourself."],
      [1, "Use the faster way only on busy days."],
      [0, "Switch to the faster way; it seems to work fine."],
    ],
    why: "Procedures are qualified for a reason. Improvements are welcome, but they go through review before anyone changes how the work is done.",
  },
  {
    id: "sjt-dropped-screw",
    competency: "quality",
    text: "While working inside an open chamber on the {tool}, you drop a small screw and can't see where it went.",
    options: [
      [3, "Stop, report it, and make sure it's found and removed before the chamber is closed, following the procedure."],
      [2, "Write it in the log, then close up the chamber."],
      [1, "Look for a minute, then close up if you can't find it."],
      [0, "Close up; a screw that small won't matter."],
    ],
    why: "A loose part inside a chamber can scratch wafers, break the tool or contaminate a whole lot. It must be found before restart.",
  },
  {
    id: "sjt-inspection-pressure",
    competency: "quality",
    text: "The team needs to hit a high output target today. You notice that skipping an inspection step would help you get there.",
    options: [
      [3, "Keep doing every inspection, and raise your concern about the target with {supervisor}."],
      [2, "Keep the inspections but work through your breaks to catch up."],
      [1, "Skip inspection only for parts that usually pass."],
      [0, "Skip the inspection today to hit the target."],
    ],
    why: "Shipping defects costs far more than a missed target. Keep quality steps and communicate the capacity problem so leaders can act.",
  },
  {
    id: "sjt-downstream",
    competency: "quality",
    text: "You hear that parts from your station are being rejected at the next process step.",
    options: [
      [3, "Tell your lead and help investigate: check your settings, materials and recent changes."],
      [2, "Quietly double-check your own work but don't mention it."],
      [1, "Work faster to make up for the rejected parts."],
      [0, "Ignore it; the problem must be at the next step."],
    ],
    why: "Good technicians own their process. Raising it early and helping find the root cause prevents more scrap.",
  },
  {
    id: "sjt-restock",
    competency: "team",
    text: "Two teammates are arguing about whose turn it is to restock supplies, and work is slowing down.",
    options: [
      [3, "Help restock so the work keeps moving, and suggest the team agree a simple rotation."],
      [2, "Ask {supervisor} to set a restocking schedule."],
      [1, "Tell them to sort it out between themselves."],
      [0, "Take one side in front of everyone."],
    ],
    why: "Keep production moving first, then fix the cause with a fair process. Taking sides escalates the conflict.",
  },
  {
    id: "sjt-new-colleague",
    competency: "team",
    text: "A new technician, {coworker}, is struggling to follow a procedure you know well.",
    options: [
      [3, "Offer to walk them through it and show where the steps are written, while keeping your own work on track."],
      [2, "Let {supervisor} know that {coworker} may need more training."],
      [1, "Do the task for them without explaining, to save time."],
      [0, "Leave them to figure it out; that's how you learned."],
    ],
    why: "Helping a teammate learn the right way builds a safer, stronger team. Doing it for them doesn't help them next time.",
  },
  {
    id: "sjt-jokes",
    competency: "team",
    text: "A teammate keeps making jokes about a colleague's accent during breaks.",
    options: [
      [3, "Say calmly that the jokes aren't okay, and report it to {supervisor} if it continues."],
      [2, "Check in privately with the colleague and offer your support."],
      [1, "Ignore it and stay out of it."],
      [0, "Laugh along so things don't get awkward."],
    ],
    why: "Respect is part of a safe workplace. Speaking up (and escalating if needed) stops the behavior; staying silent lets it continue.",
  },
  {
    id: "sjt-phone",
    competency: "team",
    text: "You see {coworker} using a personal phone inside the cleanroom, which is against the rules.",
    options: [
      [3, "Remind {coworker} politely about the rule, and tell {supervisor} if it keeps happening."],
      [2, "Report it to {supervisor} straight away without saying anything to {coworker}."],
      [1, "Post about it in the team group chat."],
      [0, "Ignore it; it's not your business."],
    ],
    why: "A direct, respectful reminder often solves it; escalate if it doesn't. Calling people out in a group chat damages trust.",
  },
  {
    id: "sjt-unclear",
    competency: "comms",
    text: "{supervisor} gives you quick instructions for a task on the {tool} and is about to leave for a meeting. You're not sure you understood one step.",
    options: [
      [3, "Ask a quick question and repeat the steps back before they leave."],
      [2, "Ask a coworker who has done the task before."],
      [1, "Wait until {supervisor} is back before starting."],
      [0, "Start anyway and do your best guess for that step."],
    ],
    why: "A 30-second question now prevents errors later. Repeating instructions back is a simple way to confirm you've understood.",
  },
  {
    id: "sjt-handover",
    competency: "comms",
    text: "Your shift is ending and a repair you started on the {tool} isn't finished.",
    options: [
      [3, "Write the status clearly in the log and brief the next shift in person."],
      [2, "Leave a sticky note on the tool describing where you stopped."],
      [1, "Stay late to finish without telling anyone."],
      [0, "Leave it; the next shift will work it out."],
    ],
    why: "Clear handovers prevent mistakes like restarting a half-assembled tool. Log it formally and talk to the next shift.",
  },
  {
    id: "sjt-priorities",
    competency: "comms",
    text: "Two engineers each ask you to do their urgent task first.",
    options: [
      [3, "Check with your lead or {supervisor} which task is the higher priority, then let both engineers know the plan."],
      [2, "Do the quicker task first and tell both engineers what you're doing."],
      [1, "Do the task for the engineer you get along with best."],
      [0, "Wait until the two engineers agree between themselves."],
    ],
    why: "Priorities are set by the people responsible for the schedule. Confirm, then communicate, so nobody is surprised.",
  },
  {
    id: "sjt-late",
    competency: "reliable",
    text: "Your car won't start and you'll be about 30 minutes late for your shift.",
    options: [
      [3, "Call {supervisor} as soon as you can with an estimated arrival time."],
      [2, "Text a coworker and ask them to tell {supervisor}."],
      [1, "Explain to {supervisor} when you arrive."],
      [0, "Arrive late without telling anyone."],
    ],
    why: "Shifts are planned around who is there. Early, direct notice lets your supervisor cover your work.",
  },
  {
    id: "sjt-fatigue",
    competency: "reliable",
    text: "It's the end of a long double shift and you're very tired. You're asked to do a precise calibration on the {tool}.",
    options: [
      [3, "Tell {supervisor} honestly that you're fatigued, and ask whether it can be reassigned or double-checked."],
      [2, "Do it, and ask a coworker to double-check your work."],
      [1, "Have an energy drink and push through."],
      [0, "Do it quickly so you can go home."],
    ],
    why: "Fatigue causes errors in precise work. Being honest lets your supervisor manage the risk; that's reliability, not weakness.",
  },
  {
    id: "sjt-downtime",
    competency: "reliable",
    text: "Your tool is down for two hours waiting for a replacement part.",
    options: [
      [3, "Ask your lead what else needs doing, such as helping another area, training or housekeeping."],
      [2, "Clean and organize your work area while you wait."],
      [1, "Browse your phone until the part arrives."],
      [0, "Take an extra-long break."],
    ],
    why: "Downtime is a chance to add value. Checking with your lead makes sure your time goes where it's needed most.",
  },
  {
    id: "sjt-supplies",
    competency: "reliable",
    text: "{coworker} says it's fine to take extra gloves and cleanroom wipes home because 'nobody counts them'.",
    options: [
      [3, "Decline and follow company policy on supplies."],
      [2, "Ask {supervisor} whether that's allowed before doing anything."],
      [1, "Don't take any, but say nothing."],
      [0, "Take some; they're only small things."],
    ],
    why: "Taking company property without permission is theft, whatever the value. Following policy protects you and your job.",
  },
  {
    id: "sjt-untrained",
    competency: "learning",
    text: "You're asked to run the {tool}, which you haven't been trained or certified on yet.",
    options: [
      [3, "Explain that you haven't been trained on it and ask for training or supervision first."],
      [2, "Ask an experienced coworker to walk you through it while they watch."],
      [1, "Watch an online video about similar tools, then try it."],
      [0, "Try it anyway; you'll learn faster by doing."],
    ],
    why: "Only trained, certified people run fab equipment. Asking for training is the professional choice.",
  },
  {
    id: "sjt-feedback",
    competency: "learning",
    text: "{supervisor} points out a mistake in your work in front of the team.",
    options: [
      [3, "Listen, ask how to fix it and avoid it next time, then fix it."],
      [2, "Accept it, and ask to talk through the details privately later."],
      [1, "Say nothing, but feel annoyed for the rest of the day."],
      [0, "Argue that it wasn't really your fault."],
    ],
    why: "Taking feedback well is how technicians grow. Focus on the fix and the lesson, not on who was watching.",
  },
];

export const SCENARIO_COUNT = SCENARIOS.length;

function fill(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? k);
}

/** A fresh set of scenarios (unseen ones first), with names/details filled in and options shuffled. */
export function judgementQuiz(rng: Rng, recent: readonly string[] = [], count = 10): QuizQuestion[] {
  return pickFresh(rng, SCENARIOS, count, recent).map((sc) => {
    const vars = { coworker: pick(rng, COWORKERS), supervisor: pick(rng, SUPERVISORS), tool: pick(rng, TOOLS) };
    const opts = shuffle(rng, sc.options);
    const best = opts.findIndex(([score]) => score === 3);
    return {
      id: sc.id,
      section: COMPETENCIES[sc.competency],
      prompt: "What is the MOST effective response?",
      visual: { type: "scenario", context: COMPETENCIES[sc.competency], text: fill(sc.text, vars) },
      options: opts.map(([score, text]) => ({ score, text: fill(text, vars) })),
      answer: best,
      explanation: fill(sc.why, vars),
    };
  });
}

export function judgementLevel(pct: number): { label: string; note: string } {
  if (pct >= 90) return { label: "Excellent judgement", note: "You consistently choose safe, honest, team-first responses, exactly what fabs look for." };
  if (pct >= 75) return { label: "Sound judgement", note: "Good instincts. Review where a 'good' answer wasn't the 'best' one." };
  if (pct >= 55) return { label: "Developing", note: "Remember the priorities: safety first, follow procedures, be honest, and communicate early." };
  return { label: "Keep practising", note: "When in doubt: stop, follow the procedure, and tell your supervisor. Read each explanation." };
}
