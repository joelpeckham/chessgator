export const COL_W = 60;
export const LANE_H = 40;
/** Trunk plus one side rail each way. */
export const GRAPH_LANE_COUNT = 3;
/** Short fork caption above the glyph ("Gator"). */
export const NODE_CAPTION_H = 12;
/** SAN under the glyph. */
export const NODE_LABEL_H = 14;
/** Keeps 44px hit targets and captions inside the svg box. */
export const GRAPH_PAD_TOP = 8;
export const GRAPH_H =
  GRAPH_PAD_TOP + NODE_CAPTION_H + GRAPH_LANE_COUNT * LANE_H + NODE_LABEL_H;
export const PRACTICE_BAR_H = 32;
export const STATUS_ROW_H = 24;
/** Fixed footer so board size never shifts with coach/practice chrome. */
export const TIMELINE_GRAPH_HEIGHT_PX = STATUS_ROW_H + GRAPH_H + PRACTICE_BAR_H;

/** Mobile hit target (`size-11`); desktop buttons use `sm:size-9` (36px). */
export const NODE_HIT_PX = 44;
const LABEL_FROM_CENTER = 12;
const CAPTION_FROM_CENTER = 18;

export function graphNodeCenter(
  column: number,
  lane: number,
): { cx: number; cy: number } {
  const cy = GRAPH_PAD_TOP + NODE_CAPTION_H + LANE_H * (1 - lane) + LANE_H / 2;
  return {
    cx: column * COL_W + COL_W / 2,
    cy,
  };
}

export function graphLabelTop(cy: number): number {
  return cy + LABEL_FROM_CENTER;
}

export function graphCaptionTop(cy: number): number {
  return cy - CAPTION_FROM_CENTER;
}
