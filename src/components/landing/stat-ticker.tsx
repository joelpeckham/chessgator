"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/prefers-reduced-motion";

export type StatTickerProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  durationMs?: number;
  /** Thousands separators; off for values shown next to plain numbers. */
  grouped?: boolean;
};

/**
 * Number that counts up when scrolled into view. Server-renders the final
 * value so the stat is always readable without JavaScript.
 */
export function StatTicker({
  value,
  prefix = "",
  suffix = "",
  label,
  durationMs = 1200,
  grouped = true,
}: StatTickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!inView || reducedMotion || value === 0) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reducedMotion, value, durationMs]);

  return (
    <div ref={ref} className="space-y-1">
      <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
        {prefix}
        {grouped ? display.toLocaleString("en-US") : String(display)}
        {suffix}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
