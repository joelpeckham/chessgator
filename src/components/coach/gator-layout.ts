import type { GatorExpression } from "@/components/coach/gator-expression";

/** CSS px per artboard unit. Heads land around 96–102px tall. */
export const GATOR_ART_SCALE = 1 / 3;

export const GATOR_ART: Record<
  GatorExpression,
  { width: number; height: number }
> = {
  "neutral-happy": { width: 202.16, height: 292.018 },
  sad: { width: 200.917, height: 291.95 },
  mischievous: { width: 212.842, height: 290.435 },
  shocked: { width: 214.027, height: 307.993 },
  angry: { width: 209.005, height: 301.419 },
  confused: { width: 261.119, height: 301.264 },
  scared: { width: 222.396, height: 307.113 },
};

export const CLAWS_SRC = "/coach/gator-claws.svg";

export const CLAWS_ART = {
  width: 284.801,
  height: 61.964,
  /** Distance from the claws image top to the inside-corner notch. */
  cutoutFromTop: 26.123,
} as const;

export function gatorDisplaySize(expression: GatorExpression): {
  width: number;
  height: number;
} {
  const art = GATOR_ART[expression];
  return {
    width: art.width * GATOR_ART_SCALE,
    height: art.height * GATOR_ART_SCALE,
  };
}

export const CLAWS_DISPLAY = {
  width: CLAWS_ART.width * GATOR_ART_SCALE,
  height: CLAWS_ART.height * GATOR_ART_SCALE,
  cutoutFromTop: CLAWS_ART.cutoutFromTop * GATOR_ART_SCALE,
};

const HEAD_HEIGHTS = Object.values(GATOR_ART).map(
  (art) => art.height * GATOR_ART_SCALE,
);

/** Reserved left strip so the board never sits on the peeking gator. */
export const MASCOT_PEEK_WIDTH_PX = 120;
/** Tallest head, plus a little air above the timeline ledge. */
export const MASCOT_PEEK_HEIGHT_PX = Math.ceil(Math.max(...HEAD_HEIGHTS)) + 4;
/** Pull the neck under the footer border so the crop tucks behind the ledge. */
export const GATOR_LEDGE_OVERLAP_PX = 0;
