/** Lightweight horizontal bar chart (no chart library needed). */
export function Bars({ data, total, accent = "maroon" }: { data: Array<{ label: string; value: number }>; total?: number; accent?: "maroon" | "gold" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-bold text-ink">{d.label}</span>
            <span className="tabular-nums text-ink/60">
              {d.value}
              {total ? <span className="ml-1 text-xs">({Math.round((d.value / Math.max(total, 1)) * 100)}%)</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/5">
            <div className={`h-full rounded-full ${accent === "gold" ? "bg-gold" : "bg-maroon"}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ points }: { points: Array<{ day: string; n: number }> }) {
  if (!points.length) return <p className="text-sm text-ink/50">No applications in the last 60 days.</p>;
  const w = 600;
  const h = 120;
  const max = Math.max(1, ...points.map((p) => p.n));
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points.map((p, i) => [i * step, h - (p.n / max) * (h - 10) - 5]);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" role="img" aria-label="Applications per day, last 60 days">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8C1D40" stopOpacity="0.35" />
          <stop offset="1" stopColor="#8C1D40" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#spark)" />
      <path d={line} fill="none" stroke="#8C1D40" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}
