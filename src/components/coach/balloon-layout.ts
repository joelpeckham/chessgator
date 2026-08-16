/** Keep the balloon off the chrome and the viewport edge. */
export const COACH_VIEWPORT_PAD_X_PX = 16;
/** Grow left of the gator only when a readable card fits there. */
export const COACH_MIN_MARGIN_BALLOON_PX = 220;
export const COACH_BALLOON_MAX_PX = 36 * 16;

export type BalloonAnchor = "margin" | "over";

export type BalloonLayout = {
  /** Mascot-relative left offset; used when the balloon grows right. */
  left: number;
  maxWidth: number;
  /**
   * Tail offset toward the gator center. `margin` measures from the
   * balloon's right edge; `over` measures from the left.
   */
  tailInset: number;
  anchor: BalloonAnchor;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Grow the speech balloon from the gator. If the leftover strip left of
 * the gator is wide enough, grow left (stays off the board). Otherwise
 * grow right (may overlap the board). Both edges stay on-screen.
 */
export function computeBalloonLayout(args: {
  mascotLeft: number;
  headWidth: number;
  viewportWidth: number;
}): BalloonLayout {
  const { mascotLeft, headWidth, viewportWidth } = args;
  const gatorRight = mascotLeft + headWidth;
  const gatorCenter = mascotLeft + headWidth / 2;
  const spaceLeft = Math.max(0, gatorRight - COACH_VIEWPORT_PAD_X_PX);

  if (spaceLeft >= COACH_MIN_MARGIN_BALLOON_PX) {
    const maxWidth = Math.min(COACH_BALLOON_MAX_PX, spaceLeft);
    return {
      left: headWidth - maxWidth,
      maxWidth,
      tailInset: clamp(headWidth / 2, 12, 40),
      anchor: "margin",
    };
  }

  const balloonLeft = Math.max(COACH_VIEWPORT_PAD_X_PX, mascotLeft);
  const maxWidth = Math.min(
    COACH_BALLOON_MAX_PX,
    Math.max(0, viewportWidth - COACH_VIEWPORT_PAD_X_PX - balloonLeft),
  );
  return {
    left: balloonLeft - mascotLeft,
    maxWidth,
    tailInset: clamp(gatorCenter - balloonLeft, 12, 40),
    anchor: "over",
  };
}
