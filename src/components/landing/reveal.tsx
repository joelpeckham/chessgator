"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { settleSpring } from "@/lib/motion-presets";
import { usePrefersReducedMotion } from "@/lib/prefers-reduced-motion";

export type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds; staggers sibling sections. */
  delay?: number;
};

/**
 * Scroll-in entrance for landing sections. Content stays in the HTML for
 * crawlers; a page-level noscript style unhides it without JavaScript.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ ...settleSpring, delay }}
    >
      {children}
    </motion.div>
  );
}
