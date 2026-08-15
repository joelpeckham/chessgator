import { describe, expect, it } from "vitest";
import {
  CLAWS_DISPLAY,
  clawsClipPath,
  clawsLayerStyle,
  GATOR_ART_SCALE,
  GATOR_CLAWS,
} from "@/components/coach/gator-layout";

describe("GATOR_CLAWS", () => {
  it("hides the scratching screen-left claw on confused", () => {
    expect(GATOR_CLAWS.confused.hands).toBe("right");
  });

  it("keeps both ledge claws on the other poses", () => {
    expect(GATOR_CLAWS["neutral-happy"].hands).toBe("both");
    expect(GATOR_CLAWS.shocked.hands).toBe("both");
    expect(GATOR_CLAWS.scared.hands).toBe("both");
  });
});

describe("clawsClipPath", () => {
  it("clips the unused half, or leaves both visible", () => {
    expect(clawsClipPath("left")).toBe("inset(0 50% 0 0)");
    expect(clawsClipPath("right")).toBe("inset(0 0 0 50%)");
    expect(clawsClipPath("both")).toBeUndefined();
  });
});

describe("clawsLayerStyle", () => {
  it("places both claws with no clip and a scaled offset", () => {
    const style = clawsLayerStyle("neutral-happy", 100);
    expect(style.top).toBe(100 - CLAWS_DISPLAY.cutoutFromTop);
    expect(style.transform).toBe(
      `translateX(calc(-50% + ${GATOR_CLAWS["neutral-happy"].offsetX * GATOR_ART_SCALE}px))`,
    );
    expect(style.clipPath).toBeUndefined();
  });

  it("clips to the screen-right claw and applies a scaled offset", () => {
    const style = clawsLayerStyle("confused", 100);
    expect(style.clipPath).toBe("inset(0 0 0 50%)");
    expect(style.transform).toBe(
      `translateX(calc(-50% + ${GATOR_CLAWS.confused.offsetX * GATOR_ART_SCALE}px))`,
    );
  });
});
