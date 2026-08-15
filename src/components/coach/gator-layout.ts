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
  confused: { width: 262, height: 299.971 },
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

/** Screen-relative: `left` is the claw nearer the viewport's left edge. */
export type GatorHands = "left" | "right" | "both";

export type GatorClawsConfig = {
  hands: GatorHands;
  /** Artboard units; positive shifts the claws layer right of the head. */
  offsetX: number;
};

const BOTH_HANDS: GatorClawsConfig = { hands: "both", offsetX: -7 };

/**
 * Per-pose ledge claws. Confused scratches with the screen-left hand,
 * so only the opposite claw rests on the timeline.
 */
export const GATOR_CLAWS: Record<GatorExpression, GatorClawsConfig> = {
  "neutral-happy": BOTH_HANDS,
  sad: BOTH_HANDS,
  mischievous: { hands: "both", offsetX: 0 },
  shocked: BOTH_HANDS,
  confused: { hands: "right", offsetX: 17 },
  scared: BOTH_HANDS,
};

export function clawsClipPath(hands: GatorHands): string | undefined {
  if (hands === "left") return "inset(0 50% 0 0)";
  if (hands === "right") return "inset(0 0 0 50%)";
  return undefined;
}

export function clawsLayerStyle(
  expression: GatorExpression,
  headHeight: number,
): {
  top: number;
  width: number;
  height: number;
  transform: string;
  clipPath?: string;
} {
  const { hands, offsetX } = GATOR_CLAWS[expression];
  const shiftPx = offsetX * GATOR_ART_SCALE;
  const clipPath = clawsClipPath(hands);
  return {
    top: headHeight - CLAWS_DISPLAY.cutoutFromTop,
    width: CLAWS_DISPLAY.width,
    height: CLAWS_DISPLAY.height,
    transform: `translateX(calc(-50% + ${shiftPx}px))`,
    ...(clipPath ? { clipPath } : {}),
  };
}

const HEAD_HEIGHTS = Object.values(GATOR_ART).map(
  (art) => art.height * GATOR_ART_SCALE,
);

/** Reserved left strip so the board never sits on the peeking gator. */
export const MASCOT_PEEK_WIDTH_PX = 128;
/** Wide-screen coach lane for the always-open teaching card; centers with the board. */
export const COACH_COLUMN_WIDTH_PX = 380;
/** Tallest head, plus a little air above the timeline ledge. */
export const MASCOT_PEEK_HEIGHT_PX = Math.ceil(Math.max(...HEAD_HEIGHTS)) + 4;
/** Inset from the screen edge so claws are not clipped. */
export const GATOR_LEDGE_INSET_PX = 24;
/** A few pixels of the head sit under the timeline edge so the border crops the neck. */
export const GATOR_LEDGE_OVERLAP_PX = 3;
