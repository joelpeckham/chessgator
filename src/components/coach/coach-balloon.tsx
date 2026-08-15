"use client";

import { RiCloseLine } from "@remixicon/react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { popSpring } from "@/lib/motion-presets";

export type CoachBalloonProps = {
  children: ReactNode;
  onCollapse: () => void;
};

function focusCloseOnMount(node: HTMLButtonElement | null): void {
  node?.focus();
}

/**
 * Speech balloon for opt-in coach details. Positioned by CoachMascot.
 */
export function CoachBalloon({ children, onCollapse }: CoachBalloonProps) {
  return (
    <motion.div
      id="coach-balloon"
      className="coach-balloon"
      data-testid="coach-balloon"
      style={{ originX: 0, originY: 1 }}
      initial={{ opacity: 0, scale: 0.88, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{
        opacity: 0,
        scale: 0.92,
        y: 6,
        transition: { duration: 0.16, ease: "easeIn" },
      }}
      transition={popSpring}
    >
      <div className="coach-balloon-body relative px-3 py-3 sm:px-4">
        <Button
          ref={focusCloseOnMount}
          type="button"
          size="icon-xs"
          variant="ghost"
          className="absolute top-2 right-2 z-10"
          aria-label="Collapse coach feedback"
          data-testid="collapse-teaching-card"
          onClick={onCollapse}
        >
          <RiCloseLine />
        </Button>
        {children}
      </div>
    </motion.div>
  );
}
