/** Hand tools used in advanced manufacturing facilities: study content and the recognition quiz. */
import { shuffle, type Rng } from "@/lib/practice";
import { pickFresh, type QuizQuestion } from "@/lib/quiz";

export type ToolCategory = "Fastening" | "Gripping & cutting" | "Striking & punching" | "Measuring & layout" | "Cutting & shaping" | "Electrical & precision" | "Clamping";

export type HandTool = {
  id: string;
  name: string;
  aka?: string;
  category: ToolCategory;
  use: string;
  tip: string;
  /** "Which tool would you use to…" prompts that only this tool answers well. */
  tasks: string[];
};

export const TOOLS: HandTool[] = [
  // Fastening
  {
    id: "combination-wrench",
    name: "Combination wrench",
    aka: "Spanner",
    category: "Fastening",
    use: "Turns nuts and bolts. One end is open for quick access, the other is a closed ring (box end) for a firm grip.",
    tip: "Pull the wrench toward you rather than pushing, so your knuckles are safe if it slips.",
    tasks: ["loosen a tight hex bolt where you can fit a closed ring around the head"],
  },
  {
    id: "adjustable-wrench",
    name: "Adjustable wrench",
    aka: "Crescent wrench",
    category: "Fastening",
    use: "A wrench whose jaw width is set with a thumb screw, so one tool fits many nut sizes.",
    tip: "Snug the jaws fully onto the flats and pull toward the fixed jaw to avoid rounding the nut.",
    tasks: ["turn nuts of several different sizes when you can only carry one wrench"],
  },
  {
    id: "socket-ratchet",
    name: "Socket wrench (ratchet)",
    category: "Fastening",
    use: "Drives interchangeable sockets. The ratchet lets you keep turning a fastener without removing the tool.",
    tip: "Check the direction switch before you pull; a wrong setting can strip threads or bruise knuckles.",
    tasks: ["quickly spin many bolts on a panel without lifting the tool off each bolt"],
  },
  {
    id: "torque-wrench",
    name: "Torque wrench",
    category: "Fastening",
    use: "Tightens a fastener to an exact twisting force (torque), set on a scale in N·m or ft·lb.",
    tip: "Stop pulling at the click. Return click-type wrenches to their lowest setting for storage to keep them accurate.",
    tasks: ["tighten chamber lid bolts to exactly 25 N·m as the maintenance procedure specifies"],
  },
  {
    id: "hex-key",
    name: "Hex key",
    aka: "Allen key / Allen wrench",
    category: "Fastening",
    use: "An L-shaped hexagonal bar that turns screws with a six-sided socket in the head.",
    tip: "Use the long arm for reach and the short arm for extra leverage. Make sure the key is fully seated.",
    tasks: ["remove a socket head cap screw that has a six-sided hole in its head"],
  },
  {
    id: "nut-driver",
    name: "Nut driver",
    category: "Fastening",
    use: "Looks like a screwdriver, but the tip is a hollow hex socket for small nuts and hex-head screws.",
    tip: "Match the socket size exactly; hollow shafts let you drive a nut down a long threaded stud.",
    tasks: ["turn small hex nuts on a circuit board standoff using a screwdriver-style handle"],
  },
  {
    id: "flat-screwdriver",
    name: "Flathead screwdriver",
    aka: "Slotted screwdriver",
    category: "Fastening",
    use: "Turns screws with a single straight slot in the head.",
    tip: "Choose a blade that fills the slot width. Never use a screwdriver as a pry bar or chisel.",
    tasks: ["turn a screw that has a single straight slot across its head"],
  },
  {
    id: "phillips-screwdriver",
    name: "Phillips screwdriver",
    category: "Fastening",
    use: "Turns screws with a cross-shaped (+) recess in the head.",
    tip: "Press firmly into the recess while turning to stop the tip from 'camming out' and stripping the screw.",
    tasks: ["remove a cover screw with a cross-shaped recess in its head"],
  },

  // Gripping & cutting
  {
    id: "needle-nose-pliers",
    name: "Needle-nose pliers",
    aka: "Long-nose pliers",
    category: "Gripping & cutting",
    use: "Long, thin jaws for gripping, bending and placing small parts in tight spaces.",
    tip: "Don't twist hard with the thin tips; they bend or snap. Use a bigger plier for heavy gripping.",
    tasks: ["reach into a crowded enclosure to grab a dropped washer"],
  },
  {
    id: "slip-joint-pliers",
    name: "Slip-joint pliers",
    category: "Gripping & cutting",
    use: "General-purpose gripping pliers; the pivot slides between two positions to open the jaws wider.",
    tip: "Don't use pliers on nuts and bolts; they round the corners. Use a wrench instead.",
    tasks: ["grip a round pipe fitting that is too big for your needle-nose pliers"],
  },
  {
    id: "locking-pliers",
    name: "Locking pliers",
    aka: "Vise-Grip",
    category: "Gripping & cutting",
    use: "Pliers that lock onto a part with an adjustable screw, freeing your hand; a lever releases them.",
    tip: "Set the clamping force with the end screw first, then squeeze to lock. Release with the lever, not by prying.",
    tasks: ["clamp onto a stripped bolt head and keep hold of it hands-free"],
  },
  {
    id: "diagonal-cutters",
    name: "Diagonal cutters",
    aka: "Side cutters / dikes",
    category: "Gripping & cutting",
    use: "Cuts wire, cable ties and small leads flush with the surface.",
    tip: "Cover the loose end or point it down when cutting; clipped wire can fly off. Wear safety glasses.",
    tasks: ["snip a cable tie off a wiring harness close to the surface"],
  },
  {
    id: "wire-stripper",
    name: "Wire stripper",
    category: "Gripping & cutting",
    use: "Removes insulation from electrical wire without nicking the copper, using notches sized by wire gauge.",
    tip: "Use the notch that matches the wire gauge; too small a notch cuts strands and weakens the joint.",
    tasks: ["remove 6 mm of insulation from an 18 AWG wire without damaging the copper"],
  },
  {
    id: "crimper",
    name: "Crimping tool",
    aka: "Crimper",
    category: "Gripping & cutting",
    use: "Squeezes a metal terminal or connector tightly onto a wire, using color-coded dies (red, blue, yellow).",
    tip: "Match the die color to the terminal color and give a firm pull test after crimping.",
    tasks: ["attach a blue insulated ring terminal to the end of a stripped wire"],
  },

  // Striking & punching
  {
    id: "claw-hammer",
    name: "Claw hammer",
    category: "Striking & punching",
    use: "Drives nails with the flat face; the curved claw on the back pulls them out.",
    tip: "Never strike another hammer or hardened tool; the steel can chip and fly.",
    tasks: ["pull a nail out of a wooden shipping crate"],
  },
  {
    id: "ball-peen-hammer",
    name: "Ball-peen hammer",
    aka: "Machinist's hammer",
    category: "Striking & punching",
    use: "A metalworking hammer with a flat face and a rounded ball end for shaping metal and setting rivets.",
    tip: "Use it with punches and chisels. Check the head is tight on the handle before use.",
    tasks: ["strike a steel punch or shape the end of a metal rivet"],
  },
  {
    id: "dead-blow-mallet",
    name: "Dead-blow mallet",
    category: "Striking & punching",
    use: "A soft-faced mallet filled with shot, so it hits without bouncing back or marring parts.",
    tip: "Ideal for seating parts on precision equipment without denting them.",
    tasks: ["tap a precision bracket into alignment without denting or marking it"],
  },
  {
    id: "center-punch",
    name: "Center punch",
    category: "Striking & punching",
    use: "A hardened pointed rod that makes a small dimple so a drill bit starts in exactly the right spot.",
    tip: "Hold it square to the surface and strike once, firmly, with a ball-peen hammer.",
    tasks: ["mark the exact spot on a steel plate so the drill bit doesn't wander"],
  },

  // Measuring & layout
  {
    id: "tape-measure",
    name: "Tape measure",
    category: "Measuring & layout",
    use: "A retractable steel ruler for measuring longer lengths, with a hook on the end.",
    tip: "The end hook slides slightly on purpose so inside and outside measurements are both accurate.",
    tasks: ["measure the 2.4 m length of a cable tray run"],
  },
  {
    id: "caliper",
    name: "Digital caliper",
    aka: "Vernier caliper",
    category: "Measuring & layout",
    use: "Measures outside, inside and depth dimensions precisely, typically to 0.01 mm.",
    tip: "Zero the caliper with the jaws closed and clean before measuring.",
    tasks: ["measure the inside diameter of a fitting to the nearest 0.01 mm"],
  },
  {
    id: "micrometer",
    name: "Micrometer",
    category: "Measuring & layout",
    use: "A very precise measuring tool with a C-frame and a screw thimble, reading to 0.001 mm on some models.",
    tip: "Use the ratchet stop on the thimble so you apply the same light pressure every time.",
    tasks: ["check the thickness of a shim to within a few thousandths of a millimetre"],
  },
  {
    id: "spirit-level",
    name: "Spirit level",
    aka: "Bubble level",
    category: "Measuring & layout",
    use: "Shows if a surface is level (horizontal) or plumb (vertical) using an air bubble in a liquid vial.",
    tip: "Check both directions; flip the level end-for-end to confirm it reads the same.",
    tasks: ["make sure a new equipment cart surface is perfectly horizontal"],
  },
  {
    id: "feeler-gauge",
    name: "Feeler gauge",
    category: "Measuring & layout",
    use: "A fan of thin steel blades of known thickness used to measure small gaps.",
    tip: "The right blade should slide in with light drag. Keep blades clean and don't bend them.",
    tasks: ["measure the small gap between a sensor and its target plate"],
  },

  // Cutting & shaping
  {
    id: "utility-knife",
    name: "Utility knife",
    aka: "Box cutter",
    category: "Cutting & shaping",
    use: "A retractable-blade knife for cutting packaging, tape, gasket material and similar.",
    tip: "Always cut away from your body, retract the blade after each use, and dispose of old blades in a sharps container.",
    tasks: ["open sealed packaging tape on a delivery of spare parts"],
  },
  {
    id: "hacksaw",
    name: "Hacksaw",
    category: "Cutting & shaping",
    use: "A fine-toothed saw in a frame, used to cut metal rod, tube and bolts.",
    tip: "Install the blade with the teeth pointing forward, away from the handle; it cuts on the push stroke.",
    tasks: ["cut a length of threaded steel rod to size"],
  },
  {
    id: "file",
    name: "Metal file",
    category: "Cutting & shaping",
    use: "A hardened steel bar with rows of teeth for smoothing edges and removing burrs from metal.",
    tip: "Always use a handle on the tang, and file on the forward stroke only.",
    tasks: ["smooth a sharp burr left on the edge of a cut aluminum bracket"],
  },

  // Electrical & precision
  {
    id: "multimeter",
    name: "Digital multimeter",
    aka: "DMM",
    category: "Electrical & precision",
    use: "Measures voltage, current and resistance, and checks continuity in circuits.",
    tip: "Pick the right function and range before connecting the probes; never measure resistance on a live circuit.",
    tasks: ["check whether a fuse has continuity or is blown"],
  },
  {
    id: "soldering-iron",
    name: "Soldering iron",
    category: "Electrical & precision",
    use: "A heated tool that melts solder to join wires and electronic components.",
    tip: "Always return it to its stand, use fume extraction, and never touch the tip. It can exceed 350 °C.",
    tasks: ["join a wire to a pad on a circuit board with solder"],
  },
  {
    id: "esd-tweezers",
    name: "ESD tweezers",
    category: "Electrical & precision",
    use: "Fine-tipped tweezers made to be safe for static-sensitive parts, used to handle tiny components.",
    tip: "Use with a grounded wrist strap; static you can't feel can still destroy a chip.",
    tasks: ["place a tiny surface-mount resistor without damaging it with static"],
  },

  // Clamping
  {
    id: "c-clamp",
    name: "C-clamp",
    category: "Clamping",
    use: "A C-shaped frame with a screw that holds parts firmly together or against a bench.",
    tip: "Protect finished surfaces with pads, and don't overtighten; the frame can bend.",
    tasks: ["hold two plates together firmly while the adhesive cures"],
  },
];

export const TOOL_BY_ID: Record<string, HandTool> = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
export const TOOL_CATEGORIES = Array.from(new Set(TOOLS.map((t) => t.category)));

/** Three wrong options, preferring tools from the same category (harder, more realistic). */
function distractorTools(rng: Rng, tool: HandTool, count = 3): HandTool[] {
  const same = shuffle(rng, TOOLS.filter((t) => t.id !== tool.id && t.category === tool.category));
  const other = shuffle(rng, TOOLS.filter((t) => t.id !== tool.id && t.category !== tool.category));
  return [...same.slice(0, 2), ...other].slice(0, count);
}

function build(rng: Rng, correct: HandTool, wrong: HandTool[]): { options: HandTool[]; answer: number } {
  const options = shuffle(rng, [correct, ...wrong]);
  return { options, answer: options.indexOf(correct) };
}

/**
 * A fresh recognition quiz: name the pictured tool, pick the picture for a name, and choose the tool for
 * a job. Tools seen in recent attempts are used last, and formats/options shuffle every time.
 */
export function toolsQuiz(rng: Rng, recent: readonly string[] = [], count = 12): QuizQuestion[] {
  const tools = pickFresh(rng, TOOLS, count, recent);
  const formats = shuffle(rng, [
    ...Array.from({ length: Math.ceil(count * 0.42) }, () => "name" as const),
    ...Array.from({ length: Math.ceil(count * 0.33) }, () => "picture" as const),
    ...Array.from({ length: count }, () => "task" as const),
  ]).slice(0, count);
  return tools.map((tool, i) => {
    const { options, answer } = build(rng, tool, distractorTools(rng, tool));
    const f = formats[i];
    if (f === "name") {
      return {
        id: tool.id,
        section: "Name the tool",
        prompt: "What is this tool called?",
        visual: { type: "tool", tool: tool.id },
        options: options.map((t) => ({ text: t.name })),
        answer,
        explanation: `This is a ${tool.name.toLowerCase()}${tool.aka ? ` (also called ${tool.aka})` : ""}. ${tool.use}`,
      };
    }
    if (f === "picture") {
      return {
        id: tool.id,
        section: "Spot the tool",
        prompt: `Which picture shows a ${tool.name.toLowerCase()}?`,
        options: options.map((t) => ({ tool: t.id })),
        answer,
        explanation: `${tool.name}: ${tool.use}`,
      };
    }
    const task = tool.tasks[Math.floor(rng() * tool.tasks.length)];
    return {
      id: tool.id,
      section: "Right tool for the job",
      prompt: `Which tool would you use to ${task}?`,
      options: options.map((t) => ({ text: t.name })),
      answer,
      explanation: `${tool.name}: ${tool.use} Tip: ${tool.tip}`,
    };
  });
}

export function toolsLevel(pct: number): { label: string; note: string } {
  if (pct >= 90) return { label: "Tool expert", note: "You know your way around a toolbox. Great preparation for hands-on labs." };
  if (pct >= 75) return { label: "Confident", note: "Solid recognition. Study the ones you missed in the tool library." };
  if (pct >= 50) return { label: "Getting familiar", note: "Browse the tool library and use 'hide names' mode to quiz yourself." };
  return { label: "Just starting", note: "No problem. The program teaches these tools. Start with the tool library to learn the basics." };
}
