import type { GatorExpression } from "@/components/coach/gator-expression";

/** CSS px per artboard unit. Heads land around 96–102px tall. */
export const GATOR_ART_SCALE = 1 / 3;

export const GATOR_ART: Record<
  GatorExpression,
  { width: number; height: number }
> = {
  "neutral-happy": { width: 202.16, height: 291.502 },
  sad: { width: 200.917, height: 291.439 },
  mischievous: { width: 212.842, height: 289.919 },
  shocked: { width: 214.027, height: 307.068 },
  confused: { width: 262, height: 300.325 },
  scared: { width: 222.396, height: 306.109 },
};

export const CLAWS_SRC = "/coach/gator-claws.svg";

export const CLAWS_ART = {
  width: 284.801,
  height: 61.964,
  /** Distance from the claws image top to the inside-corner notch. */
  cutoutFromTop: 26.123,
} as const;

export function gatorDisplaySize(
  expression: GatorExpression,
  scale = GATOR_ART_SCALE,
): {
  width: number;
  height: number;
} {
  const art = GATOR_ART[expression];
  return {
    width: art.width * scale,
    height: art.height * scale,
  };
}

function clawsDisplaySize(scale = GATOR_ART_SCALE): {
  width: number;
  height: number;
  cutoutFromTop: number;
} {
  return {
    width: CLAWS_ART.width * scale,
    height: CLAWS_ART.height * scale,
    cutoutFromTop: CLAWS_ART.cutoutFromTop * scale,
  };
}

export const CLAWS_DISPLAY = clawsDisplaySize();

/**
 * The gator art is cut flat at the neck. Hover lift and nudge bounces can
 * raise that edge above the ledge, so a mirrored sliver of the same image
 * extends the neck just enough to keep the edge hidden.
 */
export const NECK_BLEED_PX = 12;
/** Pull the mirror up so the anti-aliased neck edge does not flash a gap. */
export const NECK_MIRROR_OVERLAP_PX = 2;

export function neckMirrorStyle(): {
  height: number;
  top: string;
} {
  return {
    height: NECK_BLEED_PX + NECK_MIRROR_OVERLAP_PX,
    top: `calc(100% - ${NECK_MIRROR_OVERLAP_PX}px)`,
  };
}

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
  scale = GATOR_ART_SCALE,
): {
  top: number;
  width: number;
  height: number;
  transform: string;
  clipPath?: string;
} {
  const { hands, offsetX } = GATOR_CLAWS[expression];
  const claws = clawsDisplaySize(scale);
  const shiftPx = offsetX * scale;
  const clipPath = clawsClipPath(hands);
  return {
    top: headHeight - claws.cutoutFromTop,
    width: claws.width,
    height: claws.height,
    transform: `translateX(calc(-50% + ${shiftPx}px))`,
    ...(clipPath ? { clipPath } : {}),
  };
}

const HEAD_HEIGHTS = Object.values(GATOR_ART).map(
  (art) => art.height * GATOR_ART_SCALE,
);

/** Reserved left strip so the board never sits on the peeking gator. */
export const MASCOT_PEEK_WIDTH_PX = 128;
/** Tallest head, plus a little air above the timeline ledge. */
export const MASCOT_PEEK_HEIGHT_PX = Math.ceil(Math.max(...HEAD_HEIGHTS)) + 4;
/** Inset from the screen edge so claws are not clipped. */
export const GATOR_LEDGE_INSET_PX = 24;
/** Widest head + claw margin: space the gator needs right of its left edge. */
export const MASCOT_SPAN_PX = MASCOT_PEEK_WIDTH_PX - GATOR_LEDGE_INSET_PX;
/** A few pixels of the head sit under the timeline edge so the border crops the neck. */
export const GATOR_LEDGE_OVERLAP_PX = 3;

/** Visible head above the ledge (head height minus the tucked overlap). */
export function gatorPeekLiftPx(
  expression: GatorExpression,
  scale = GATOR_ART_SCALE,
): number {
  return gatorDisplaySize(expression, scale).height - GATOR_LEDGE_OVERLAP_PX;
}
