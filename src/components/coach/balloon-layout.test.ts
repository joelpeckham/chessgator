import { describe, expect, it } from "vitest";
import {
  COACH_MIN_MARGIN_BALLOON_PX,
  COACH_VIEWPORT_PAD_X_PX,
  computeBalloonLayout,
} from "@/components/coach/balloon-layout";

describe("computeBalloonLayout", () => {
  it("grows left from the gator when leftover space is readable", () => {
    const layout = computeBalloonLayout({
      mascotLeft: 210,
      headWidth: 70,
      viewportWidth: 1280,
    });
    expect(layout.anchor).toBe("margin");
    const gatorRight = 280;
    const viewportLeft = gatorRight - layout.maxWidth;
    expect(viewportLeft).toBe(COACH_VIEWPORT_PAD_X_PX);
    expect(gatorRight).toBeLessThanOrEqual(314);
    expect(layout.maxWidth).toBe(gatorRight - COACH_VIEWPORT_PAD_X_PX);
  });

  it("points the tail at the gator from the balloon's right edge", () => {
    const layout = computeBalloonLayout({
      mascotLeft: 210,
      headWidth: 70,
      viewportWidth: 1280,
    });
    expect(layout.anchor).toBe("margin");
    expect(layout.tailInset).toBe(35);
  });

  it("grows over the board when the left strip is too narrow", () => {
    const layout = computeBalloonLayout({
      mascotLeft: 24,
      headWidth: 70,
      viewportWidth: 390,
    });
    expect(layout.anchor).toBe("over");
    expect(24 + 70 - COACH_VIEWPORT_PAD_X_PX).toBeLessThan(
      COACH_MIN_MARGIN_BALLOON_PX,
    );
    const viewportLeft = 24 + layout.left;
    const viewportRight = viewportLeft + layout.maxWidth;
    expect(viewportLeft).toBeGreaterThanOrEqual(COACH_VIEWPORT_PAD_X_PX);
    expect(viewportRight).toBeLessThanOrEqual(390 - COACH_VIEWPORT_PAD_X_PX);
  });
});
