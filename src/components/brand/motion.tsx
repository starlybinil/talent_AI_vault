"use client";

import * as React from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function CountUp({ to, prefix = "", suffix = "", className }: { to: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const value = useMotionValue(0);
  const rounded = useTransform(value, (v) => `${prefix}${Math.round(v).toLocaleString()}${suffix}`);
  const reduce = useReducedMotion();
  React.useEffect(() => {
    if (!inView) return;
    if (reduce) {
      value.set(to);
      return;
    }
    const controls = animate(value, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, to, value, reduce]);
  return (
    <motion.span ref={ref} className={className}>
      {rounded}
    </motion.span>
  );
}

export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
