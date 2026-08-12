"use client";

import { RiCloseLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

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
    <div
      id="coach-balloon"
      className="coach-balloon"
      data-testid="coach-balloon"
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
    </div>
  );
}
