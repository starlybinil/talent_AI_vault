"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Full-bleed looping background video that cross-fades through several clips.
 * Muted + playsInline so it autoplays on mobile; falls back to the poster image.
 */
export function HeroVideo({ clips, poster, interval = 8000 }: { clips: string[]; poster: string; interval?: number }) {
  const [active, setActive] = React.useState(0);
  const refs = React.useRef<Array<HTMLVideoElement | null>>([]);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (reduce || clips.length < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % clips.length), interval);
    return () => clearInterval(t);
  }, [clips.length, interval, reduce]);

  React.useEffect(() => {
    const v = refs.current[active];
    if (!v || reduce) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [active, reduce]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-ink-950" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      {!reduce &&
        clips.map((src, i) => (
          <video
            key={src}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="absolute inset-0 h-full w-full scale-105 object-cover transition-opacity duration-[1200ms] ease-out"
            style={{ opacity: i === active ? 1 : 0 }}
            src={src}
            muted
            loop
            playsInline
            autoPlay={i === 0}
            preload={i === 0 ? "auto" : "metadata"}
            poster={i === 0 ? poster : undefined}
          />
        ))}
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/65 to-ink-950/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(140,29,64,0.35),transparent_60%)]" />
    </div>
  );
}
