/**
 * Illustrations of hand tools for the Practice Lab. Pure SVG, no ids (safe to render many at once).
 * Deliberately no <title>: the recognition quiz must not reveal the tool's name on hover or to screen readers.
 */
import { cn } from "@/lib/utils";

const S = "#c3cad3"; // steel
const SD = "#7d8794"; // dark steel
const K = "#1f1f22"; // outline / black rubber
const M = "#8C1D40"; // maroon
const G = "#FFC627"; // gold
const RED = "#d64545";
const BLUE = "#2b5ea8";
const HOLE = "#f4f5f7";

const line = { stroke: K, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={cn("block", className)} role="img" aria-label="Tool illustration" focusable="false">
      {children}
    </svg>
  );
}

function Ticks({ x1, x2, y, step, h = 5, long = 5 }: { x1: number; x2: number; y: number; step: number; h?: number; long?: number }) {
  const out = [];
  for (let x = x1, i = 0; x <= x2; x += step, i++) out.push(<line key={x} x1={x} y1={y} x2={x} y2={y + (i % long === 0 ? h * 1.8 : h)} stroke={K} strokeWidth={1.2} />);
  return <>{out}</>;
}

function Inset({ children }: { children: React.ReactNode }) {
  return (
    <g>
      <circle cx="44" cy="34" r="22" fill="#fff" {...line} strokeWidth={2} />
      {children}
    </g>
  );
}

const ART: Record<string, () => React.ReactNode> = {
  "combination-wrench": () => (
    <g transform="rotate(-12 120 80)">
      <path d="M58 71 L178 73 L178 87 L58 89 Z" fill={S} {...line} />
      <path d="M66 62 L46 52 Q22 50 14 64 L38 70 Q45 72 45 77 L45 83 Q45 88 38 90 L14 96 Q22 110 46 108 L66 98 Z" fill={S} {...line} />
      <circle cx="198" cy="80" r="26" fill={S} {...line} />
      <polygon points="211,80 204.5,91.3 191.5,91.3 185,80 191.5,68.7 204.5,68.7" fill={HOLE} {...line} />
    </g>
  ),
  "adjustable-wrench": () => (
    <g transform="rotate(-12 120 80)">
      <path d="M84 70 L206 73 Q224 80 206 87 L84 90 Z" fill={S} {...line} />
      <circle cx="204" cy="80" r="4" fill={HOLE} {...line} strokeWidth={1.5} />
      <path d="M90 62 Q76 42 50 42 Q24 42 14 58 L44 66 L44 72 L90 74 Z" fill={S} {...line} />
      <path d="M44 88 L90 86 L90 98 Q76 118 50 118 Q24 118 14 102 L44 94 Z" fill={SD} {...line} />
      <rect x="56" y="74" width="26" height="12" rx="3" fill={S} {...line} />
      {[60, 65, 70, 75].map((x) => (
        <line key={x} x1={x} y1="75" x2={x + 2} y2="85" stroke={K} strokeWidth="1.3" />
      ))}
    </g>
  ),
  "socket-ratchet": () => (
    <g transform="rotate(-12 120 80)">
      <path d="M62 73 L140 72 L140 88 L62 87 Z" fill={S} {...line} />
      <rect x="136" y="68" width="88" height="24" rx="12" fill={K} {...line} />
      <rect x="150" y="76" width="60" height="8" rx="4" fill={M} />
      <circle cx="50" cy="80" r="26" fill={S} {...line} />
      <circle cx="50" cy="80" r="16" fill={SD} {...line} />
      <rect x="43" y="73" width="14" height="14" fill={K} />
      <rect x="54" y="52" width="20" height="8" rx="4" fill={M} {...line} strokeWidth={1.8} />
    </g>
  ),
  "torque-wrench": () => (
    <g transform="rotate(-10 120 80)">
      <rect x="54" y="73" width="126" height="14" rx="7" fill={S} {...line} />
      <rect x="112" y="72" width="46" height="16" rx="2" fill={HOLE} {...line} strokeWidth={1.8} />
      <Ticks x1={116} x2={154} y={73} step={4} h={4} />
      <text x="135" y="104" textAnchor="middle" fontSize="11" fontWeight="700" fill={K} fontFamily="Arial">
        N·m
      </text>
      <rect x="176" y="68" width="54" height="24" rx="12" fill={K} {...line} />
      {[186, 194, 202, 210, 218].map((x) => (
        <line key={x} x1={x} y1="70" x2={x} y2="90" stroke="#555" strokeWidth="2" />
      ))}
      <circle cx="40" cy="80" r="18" fill={S} {...line} />
      <rect x="34" y="74" width="12" height="12" fill={K} />
    </g>
  ),
  "hex-key": () => (
    <g>
      {[
        { d: "M52 28 L52 128 L100 128", w: 16 },
        { d: "M128 44 L128 128 L166 128", w: 12 },
        { d: "M190 62 L190 128 L216 128", w: 9 },
      ].map((k) => (
        <g key={k.d}>
          <path d={k.d} fill="none" stroke={K} strokeWidth={k.w + 5} strokeLinejoin="round" strokeLinecap="butt" />
          <path d={k.d} fill="none" stroke={SD} strokeWidth={k.w} strokeLinejoin="round" strokeLinecap="butt" />
          <path d={k.d} fill="none" stroke={S} strokeWidth={k.w * 0.35} strokeLinejoin="round" strokeLinecap="butt" />
        </g>
      ))}
    </g>
  ),
  "nut-driver": () => (
    <g>
      <path d="M150 64 Q146 80 150 96 L212 96 Q228 80 212 64 Z" fill={G} {...line} />
      {[166, 180, 194].map((x) => (
        <line key={x} x1={x} y1="68" x2={x} y2="92" stroke={K} strokeWidth="1.6" />
      ))}
      <rect x="140" y="72" width="12" height="16" fill={SD} {...line} />
      <rect x="66" y="76" width="76" height="8" fill={S} {...line} />
      <rect x="30" y="70" width="38" height="20" rx="2" fill={S} {...line} />
      <ellipse cx="30" cy="80" rx="4" ry="9" fill={K} />
      <Inset>
        <polygon points="56,34 50,44.4 38,44.4 32,34 38,23.6 50,23.6" fill={K} />
      </Inset>
    </g>
  ),
  "flat-screwdriver": () => (
    <g>
      <path d="M150 62 Q146 80 150 98 L212 98 Q228 80 212 62 Z" fill={M} {...line} />
      {[166, 180, 194].map((x) => (
        <line key={x} x1={x} y1="66" x2={x} y2="94" stroke="#5a1128" strokeWidth="2" />
      ))}
      <rect x="140" y="72" width="12" height="16" fill={SD} {...line} />
      <rect x="44" y="76" width="98" height="8" fill={S} {...line} />
      <path d="M44 76 L22 77 L22 83 L44 84 Z" fill={S} {...line} />
      <Inset>
        <rect x="28" y="31" width="32" height="6" rx="1" fill={K} />
      </Inset>
    </g>
  ),
  "phillips-screwdriver": () => (
    <g>
      <path d="M150 62 Q146 80 150 98 L212 98 Q228 80 212 62 Z" fill={BLUE} {...line} />
      {[166, 180, 194].map((x) => (
        <line key={x} x1={x} y1="66" x2={x} y2="94" stroke="#173a6e" strokeWidth="2" />
      ))}
      <rect x="140" y="72" width="12" height="16" fill={SD} {...line} />
      <rect x="44" y="76" width="98" height="8" fill={S} {...line} />
      <path d="M44 76 L22 80 L44 84 Z" fill={S} {...line} />
      <line x1="26" y1="80" x2="40" y2="80" stroke={K} strokeWidth="1.5" />
      <Inset>
        <rect x="41" y="20" width="6" height="28" rx="1" fill={K} />
        <rect x="30" y="31" width="28" height="6" rx="1" fill={K} />
      </Inset>
    </g>
  ),
  "needle-nose-pliers": () => (
    <g>
      <path d="M128 72 Q176 60 226 46 L230 58 Q178 72 132 82 Z" fill={RED} {...line} />
      <path d="M128 88 Q176 100 226 114 L230 102 Q178 88 132 78 Z" fill={RED} {...line} />
      <path d="M122 71 L22 78 L122 81 Z" fill={S} {...line} />
      <path d="M122 89 L22 80 L122 79 Z" fill={S} {...line} />
      <circle cx="124" cy="80" r="10" fill={SD} {...line} />
      <circle cx="124" cy="80" r="3" fill={K} />
    </g>
  ),
  "slip-joint-pliers": () => (
    <g>
      <path d="M116 72 L226 56 L228 66 L120 82 Z" fill={SD} {...line} />
      <path d="M116 88 L226 104 L228 94 L120 78 Z" fill={SD} {...line} />
      <path d="M108 68 L62 60 Q40 62 40 76 L104 80 Z" fill={S} {...line} />
      <path d="M108 92 L62 100 Q40 98 40 84 L104 80 Z" fill={S} {...line} />
      {[52, 60, 68, 76].map((x) => (
        <g key={x}>
          <line x1={x} y1="70" x2={x + 3} y2="77" stroke={K} strokeWidth="1.3" />
          <line x1={x} y1="90" x2={x + 3} y2="83" stroke={K} strokeWidth="1.3" />
        </g>
      ))}
      <rect x="98" y="72" width="26" height="16" rx="8" fill={S} {...line} />
      <circle cx="106" cy="80" r="5" fill={K} />
    </g>
  ),
  "locking-pliers": () => (
    <g>
      {/* upper handle (channel) with the adjustment screw at its end */}
      <path d="M80 58 L206 54 L206 72 L80 72 Z" fill={SD} {...line} />
      <rect x="204" y="50" width="28" height="26" rx="6" fill={S} {...line} />
      {[210, 216, 222, 228].map((x) => (
        <line key={x} x1={x} y1="52" x2={x} y2="74" stroke={K} strokeWidth="1.2" />
      ))}
      {/* toggle link */}
      <line x1="168" y1="108" x2="186" y2="68" stroke={K} strokeWidth="7" strokeLinecap="round" />
      <line x1="168" y1="108" x2="186" y2="68" stroke={S} strokeWidth="3.5" strokeLinecap="round" />
      {/* lower handle and release lever */}
      <path d="M80 88 L198 106 L194 120 L80 102 Z" fill={SD} {...line} />
      <path d="M118 110 L204 128 L202 136 L114 118 Z" fill={M} {...line} />
      {/* curved "parrot-beak" jaws with teeth */}
      <path d="M86 56 L62 56 Q34 56 24 76 L36 78 Q46 68 62 70 L86 72 Z" fill={S} {...line} />
      <path d="M86 104 L62 104 Q34 104 24 84 L36 82 Q46 92 62 90 L86 88 Z" fill={S} {...line} />
      {[44, 52, 60, 68].map((x) => (
        <g key={x}>
          <line x1={x} y1={x < 50 ? 73 : 71} x2={x + 2} y2={x < 50 ? 77 : 75} stroke={K} strokeWidth="1.3" />
          <line x1={x} y1={x < 50 ? 87 : 89} x2={x + 2} y2={x < 50 ? 83 : 85} stroke={K} strokeWidth="1.3" />
        </g>
      ))}
      <circle cx="84" cy="95" r="5" fill={K} />
      <circle cx="84" cy="64" r="4" fill={K} />
    </g>
  ),
  "diagonal-cutters": () => (
    <g>
      <path d="M124 72 Q176 62 226 52 L230 64 Q178 74 128 82 Z" fill={BLUE} {...line} />
      <path d="M124 88 Q176 98 226 108 L230 96 Q178 86 128 78 Z" fill={BLUE} {...line} />
      <path d="M118 66 L70 66 L44 80 L118 80 Z" fill={S} {...line} />
      <path d="M118 94 L70 94 L44 80 L118 80 Z" fill={S} {...line} />
      <line x1="46" y1="80" x2="104" y2="80" stroke={K} strokeWidth="2" />
      <circle cx="116" cy="80" r="10" fill={SD} {...line} />
      <circle cx="116" cy="80" r="3" fill={K} />
    </g>
  ),
  "wire-stripper": () => (
    <g>
      <path d="M132 72 Q180 62 228 52 L232 64 Q182 74 136 82 Z" fill={G} {...line} />
      <path d="M132 88 Q180 98 228 108 L232 96 Q182 86 136 78 Z" fill={G} {...line} />
      <rect x="22" y="66" width="108" height="28" rx="3" fill={S} {...line} />
      <line x1="22" y1="80" x2="130" y2="80" stroke={K} strokeWidth="2" />
      {[
        [40, 6],
        [56, 5.2],
        [71, 4.4],
        [85, 3.7],
        [98, 3],
      ].map(([x, r], i) => (
        <g key={x}>
          <circle cx={x} cy="80" r={r} fill={HOLE} stroke={K} strokeWidth="1.3" />
          <text x={x} y="62" textAnchor="middle" fontSize="8" fontWeight="700" fill={K} fontFamily="Arial">
            {10 + i * 2}
          </text>
        </g>
      ))}
      <circle cx="130" cy="80" r="8" fill={SD} {...line} />
    </g>
  ),
  crimper: () => (
    <g>
      <path d="M128 72 Q178 62 228 52 L232 64 Q180 74 132 82 Z" fill={RED} {...line} />
      <path d="M128 88 Q178 98 228 108 L232 96 Q180 86 132 78 Z" fill={RED} {...line} />
      <path d="M124 60 L40 60 Q24 80 40 100 L124 100 Z" fill={SD} {...line} />
      <line x1="32" y1="80" x2="124" y2="80" stroke={K} strokeWidth="2" />
      {[
        [58, RED],
        [80, BLUE],
        [102, G],
      ].map(([x, c]) => (
        <circle key={x as number} cx={x as number} cy="80" r="7" fill={c as string} stroke={K} strokeWidth="1.5" />
      ))}
      <circle cx="126" cy="80" r="8" fill={S} {...line} />
    </g>
  ),
  "claw-hammer": () => (
    <g>
      <rect x="84" y="60" width="20" height="92" rx="7" fill={M} {...line} />
      <rect x="81" y="108" width="26" height="44" rx="10" fill={K} {...line} />
      <rect x="38" y="36" width="28" height="32" rx="4" fill={SD} {...line} />
      <path d="M66 42 L106 42 Q150 40 184 74 L172 82 Q146 60 106 62 L66 62 Z" fill={S} {...line} />
      <path d="M150 58 L178 78" stroke={K} strokeWidth="2" />
    </g>
  ),
  "ball-peen-hammer": () => (
    <g>
      <rect x="92" y="62" width="20" height="90" rx="7" fill="#c8964f" {...line} />
      {[100, 104].map((x) => (
        <path key={x} d={`M${x} 70 Q${x + 3} 105 ${x} 146`} fill="none" stroke="#8a5f28" strokeWidth="1.3" />
      ))}
      <rect x="34" y="38" width="26" height="30" rx="4" fill={SD} {...line} />
      <path d="M60 42 L126 44 L126 64 L60 64 Z" fill={S} {...line} />
      <circle cx="140" cy="54" r="18" fill={S} {...line} />
    </g>
  ),
  "dead-blow-mallet": () => (
    <g>
      <rect x="108" y="80" width="22" height="72" rx="8" fill="#f28c28" {...line} />
      <rect x="104" y="116" width="30" height="36" rx="10" fill={K} {...line} />
      <rect x="38" y="30" width="162" height="52" rx="16" fill="#f28c28" {...line} />
      <rect x="38" y="30" width="22" height="52" rx="10" fill="#c96a14" {...line} />
      <rect x="178" y="30" width="22" height="52" rx="10" fill="#c96a14" {...line} />
    </g>
  ),
  "center-punch": () => (
    <g transform="rotate(-8 120 80)">
      <path d="M60 68 L26 78 L18 80 L26 82 L60 92 Z" fill={S} {...line} />
      <rect x="58" y="66" width="126" height="28" rx="4" fill={S} {...line} />
      {Array.from({ length: 14 }, (_, i) => 72 + i * 8).map((x) => (
        <g key={x}>
          <line x1={x} y1="68" x2={x + 8} y2="92" stroke={SD} strokeWidth="1.3" />
          <line x1={x + 8} y1="68" x2={x} y2="92" stroke={SD} strokeWidth="1.3" />
        </g>
      ))}
      <rect x="182" y="70" width="30" height="20" rx="3" fill={SD} {...line} />
    </g>
  ),
  "tape-measure": () => (
    <g>
      <rect x="14" y="108" width="102" height="18" fill="#f6d34a" {...line} />
      <Ticks x1={22} x2={112} y={108} step={5} h={5} long={2} />
      {[1, 2, 3].map((n, i) => (
        <text key={n} x={34 + i * 30} y="124" fontSize="8" fontWeight="700" fill={RED} fontFamily="Arial">
          {n}
        </text>
      ))}
      <rect x="10" y="102" width="8" height="30" rx="1" fill={SD} {...line} />
      <rect x="108" y="30" width="100" height="100" rx="24" fill={G} {...line} />
      <circle cx="158" cy="80" r="28" fill={K} />
      <circle cx="158" cy="80" r="10" fill={G} />
      <rect x="140" y="22" width="30" height="12" rx="4" fill={K} {...line} />
    </g>
  ),
  caliper: () => (
    <g>
      <rect x="28" y="48" width="204" height="16" fill={S} {...line} />
      <Ticks x1={62} x2={226} y={48} step={4} h={4} />
      <path d="M28 64 L28 132 L42 132 L52 64 Z" fill={S} {...line} />
      <path d="M32 48 L36 22 L46 22 L48 48 Z" fill={S} {...line} />
      <path d="M86 78 L96 132 L110 132 L104 78 Z" fill={S} {...line} />
      <path d="M84 48 L88 22 L98 22 L96 48 Z" fill={S} {...line} />
      <rect x="84" y="42" width="78" height="38" rx="5" fill={SD} {...line} />
      <rect x="94" y="48" width="48" height="20" rx="2" fill="#d4e8cf" stroke={K} strokeWidth="1.5" />
      <text x="138" y="63" textAnchor="end" fontSize="13" fontWeight="700" fill={K} fontFamily="monospace">
        12.70
      </text>
      <circle cx="152" cy="72" r="5" fill={K} />
      <circle cx="104" cy="74" r="3" fill={RED} />
    </g>
  ),
  micrometer: () => (
    <g>
      <path d="M50 56 L50 78 Q50 128 96 128 Q128 128 128 84 L128 56" fill="none" stroke={K} strokeWidth="26" strokeLinecap="butt" />
      <path d="M50 56 L50 78 Q50 128 96 128 Q128 128 128 84 L128 56" fill="none" stroke={M} strokeWidth="20" strokeLinecap="butt" />
      <rect x="40" y="48" width="20" height="16" fill={S} {...line} />
      <rect x="60" y="52" width="10" height="8" fill={S} {...line} />
      <rect x="84" y="52" width="36" height="8" fill={S} {...line} />
      <rect x="118" y="46" width="48" height="20" fill={S} {...line} />
      <line x1="122" y1="56" x2="164" y2="56" stroke={K} strokeWidth="1.3" />
      <Ticks x1={124} x2={162} y={50} step={4} h={4} long={5} />
      <rect x="164" y="42" width="40" height="28" rx="3" fill={SD} {...line} />
      {[170, 176, 182, 188, 194, 200].map((x) => (
        <line key={x} x1={x} y1="44" x2={x} y2="68" stroke={K} strokeWidth="1.2" />
      ))}
      <rect x="204" y="48" width="18" height="16" rx="3" fill={S} {...line} />
    </g>
  ),
  "spirit-level": () => (
    <g>
      <rect x="12" y="60" width="216" height="40" rx="5" fill={G} {...line} />
      <rect x="98" y="66" width="44" height="28" rx="5" fill={K} />
      <rect x="102" y="71" width="36" height="18" rx="9" fill="#b8e04a" stroke={K} strokeWidth="1.5" />
      <ellipse cx="120" cy="80" rx="7" ry="4.5" fill="#f4ffe0" />
      <line x1="112" y1="71" x2="112" y2="89" stroke={K} strokeWidth="1.5" />
      <line x1="128" y1="71" x2="128" y2="89" stroke={K} strokeWidth="1.5" />
      <rect x="26" y="66" width="18" height="28" rx="4" fill={K} />
      <rect x="30" y="68" width="10" height="24" rx="5" fill="#b8e04a" stroke={K} strokeWidth="1.2" />
      <rect x="168" y="70" width="46" height="20" rx="10" fill={HOLE} {...line} strokeWidth={2} />
    </g>
  ),
  "feeler-gauge": () => (
    <g>
      {[-38, -28, -18, -8, 2].map((a, i) => (
        <g key={a} transform={`rotate(${a} 56 112)`}>
          <rect x="56" y="106" width="160" height="12" rx="6" fill={i === 4 ? S : "#d4d9df"} {...line} strokeWidth={1.8} />
          <text x="180" y="115" fontSize="7.5" fontWeight="700" fill={K} fontFamily="Arial">
            {["0.30", "0.20", "0.15", "0.10", "0.05"][i]}
          </text>
        </g>
      ))}
      <rect x="30" y="96" width="46" height="32" rx="10" fill={SD} {...line} />
      <circle cx="56" cy="112" r="5" fill={S} {...line} strokeWidth={1.5} />
    </g>
  ),
  "utility-knife": () => (
    <g transform="rotate(-8 120 80)">
      <path d="M62 68 L204 62 Q222 80 204 98 L62 94 Z" fill={G} {...line} />
      <path d="M120 88 L200 90 Q210 88 212 80 L120 80 Z" fill={K} />
      <path d="M62 70 L26 82 L36 92 L62 92 Z" fill="#e3e7ec" {...line} />
      <line x1="36" y1="88" x2="58" y2="88" stroke={SD} strokeWidth="1.2" />
      <rect x="104" y="58" width="26" height="10" rx="4" fill={K} {...line} strokeWidth={1.8} />
    </g>
  ),
  hacksaw: () => (
    <g>
      <path d="M40 66 L40 42 L200 42 L200 66" fill="none" stroke={K} strokeWidth="11" strokeLinejoin="round" />
      <path d="M40 66 L40 42 L200 42 L200 66" fill="none" stroke={SD} strokeWidth="7" strokeLinejoin="round" />
      <rect x="36" y="62" width="168" height="10" fill={S} {...line} strokeWidth={1.8} />
      <path d={`M38 72 ${Array.from({ length: 27 }, (_, i) => `L${41 + i * 6} 77 L${44 + i * 6} 72`).join(" ")}`} fill={S} stroke={K} strokeWidth="1.3" />
      <path d="M196 38 L218 38 Q240 76 224 124 L204 124 Q214 84 196 70 Z" fill={M} {...line} />
      <path d="M208 54 Q220 78 212 110" fill="none" stroke="#5a1128" strokeWidth="2" />
      <circle cx="30" cy="66" r="7" fill={S} {...line} strokeWidth={1.8} />
    </g>
  ),
  file: () => (
    <g transform="rotate(-6 120 80)">
      <path d="M44 70 L172 67 L172 93 L44 90 L26 80 Z" fill={SD} {...line} />
      {Array.from({ length: 18 }, (_, i) => 44 + i * 7).map((x) => (
        <g key={x}>
          <line x1={x} y1="71" x2={x + 7} y2="89" stroke="#4d5560" strokeWidth="1.1" />
          <line x1={x + 7} y1="71" x2={x} y2="89" stroke="#4d5560" strokeWidth="1.1" />
        </g>
      ))}
      <rect x="172" y="74" width="12" height="12" fill={SD} {...line} />
      <rect x="182" y="64" width="46" height="32" rx="14" fill="#c8964f" {...line} />
      <rect x="182" y="64" width="10" height="32" rx="3" fill={S} {...line} />
    </g>
  ),
  multimeter: () => (
    <g>
      <path d="M100 136 Q120 152 176 140 Q206 132 214 104" fill="none" stroke={RED} strokeWidth="4" strokeLinecap="round" />
      <path d="M86 136 Q96 156 150 154 Q196 150 222 124" fill="none" stroke={K} strokeWidth="4" strokeLinecap="round" />
      <path d="M210 100 L226 70 L232 72 L218 104 Z" fill={RED} {...line} strokeWidth={1.8} />
      <line x1="229" y1="71" x2="236" y2="56" stroke={SD} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M218 122 L236 96 L240 100 L224 126 Z" fill={K} {...line} strokeWidth={1.8} />
      <rect x="66" y="10" width="104" height="136" rx="16" fill={G} {...line} />
      <rect x="74" y="18" width="88" height="120" rx="9" fill={K} />
      <rect x="82" y="26" width="72" height="28" rx="3" fill="#d4e8cf" />
      <text x="148" y="47" textAnchor="end" fontSize="17" fontWeight="700" fill={K} fontFamily="monospace">
        12.6
      </text>
      <circle cx="118" cy="88" r="22" fill={SD} stroke="#444" strokeWidth="2" />
      <rect x="115" y="68" width="6" height="18" rx="2" fill={HOLE} />
      {[
        ["V", 90, 72],
        ["Ω", 142, 72],
        ["A", 146, 104],
        ["~", 88, 106],
      ].map(([t, x, y]) => (
        <text key={t as string} x={x as number} y={y as number} fontSize="10" fontWeight="700" fill={HOLE} fontFamily="Arial" textAnchor="middle">
          {t}
        </text>
      ))}
      <circle cx="94" cy="126" r="5" fill={K} stroke="#666" strokeWidth="2" />
      <circle cx="118" cy="126" r="5" fill={RED} stroke="#666" strokeWidth="2" />
      <circle cx="142" cy="126" r="5" fill={RED} stroke="#666" strokeWidth="2" />
    </g>
  ),
  "soldering-iron": () => (
    <g transform="rotate(-10 120 80)">
      <path d="M208 80 Q232 80 230 110 Q228 140 196 150" fill="none" stroke={K} strokeWidth="5" strokeLinecap="round" />
      <path d="M58 77 L22 80 L58 83 Z" fill="#c27c3a" {...line} strokeWidth={1.8} />
      <rect x="56" y="74" width="62" height="12" fill={S} {...line} />
      <rect x="116" y="66" width="10" height="28" rx="3" fill={SD} {...line} />
      <rect x="124" y="69" width="88" height="22" rx="11" fill={BLUE} {...line} />
      {[138, 148, 158, 168, 178].map((x) => (
        <line key={x} x1={x} y1="71" x2={x} y2="89" stroke="#173a6e" strokeWidth="2" />
      ))}
      <path d="M26 70 Q22 64 28 58" fill="none" stroke="#f28c28" strokeWidth="2" strokeLinecap="round" />
      <path d="M36 68 Q32 62 38 56" fill="none" stroke="#f28c28" strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  "esd-tweezers": () => (
    <g transform="rotate(-8 120 80)">
      <path d="M220 74 L64 68 L22 78 L64 73 L220 80 Z" fill={S} {...line} strokeWidth={2} />
      <path d="M220 86 L64 92 L22 82 L64 87 L220 80 Z" fill={S} {...line} strokeWidth={2} />
      <path d="M200 74.5 L110 70.8 L110 74.6 L200 78.6 Z" fill={BLUE} />
      <path d="M200 85.5 L110 89.2 L110 85.4 L200 81.4 Z" fill={BLUE} />
      <rect x="214" y="72" width="12" height="16" rx="3" fill={SD} {...line} strokeWidth={2} />
    </g>
  ),
  "c-clamp": () => (
    <g>
      <path d="M62 34 L154 34 Q176 34 176 56 L176 104 Q176 126 154 126 L62 126" fill="none" stroke={K} strokeWidth="22" strokeLinecap="butt" strokeLinejoin="round" />
      <path d="M62 34 L154 34 Q176 34 176 56 L176 104 Q176 126 154 126 L62 126" fill="none" stroke={RED} strokeWidth="16" strokeLinecap="butt" strokeLinejoin="round" />
      <rect x="52" y="42" width="24" height="8" rx="2" fill={SD} {...line} strokeWidth={1.8} />
      <rect x="60" y="60" width="8" height="92" fill={S} {...line} strokeWidth={1.8} />
      {Array.from({ length: 10 }, (_, i) => 64 + i * 8).map((y) => (
        <line key={y} x1="60" y1={y} x2="68" y2={y + 4} stroke={K} strokeWidth="1" />
      ))}
      <rect x="52" y="54" width="24" height="8" rx="2" fill={SD} {...line} strokeWidth={1.8} />
      <rect x="38" y="146" width="52" height="8" rx="4" fill={S} {...line} strokeWidth={1.8} />
    </g>
  ),
};

export function ToolArt({ id, className }: { id: string; className?: string }) {
  const draw = ART[id];
  return <Svg className={className}>{draw ? draw() : <text x="120" y="84" textAnchor="middle">?</text>}</Svg>;
}

export const TOOL_ART_IDS = Object.keys(ART);
