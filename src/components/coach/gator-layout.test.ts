import { describe, expect, it } from "vitest";
import {
  CLAWS_ART,
  CLAWS_DISPLAY,
  clawsClipPath,
  clawsLayerStyle,
  GATOR_ART,
  GATOR_ART_SCALE,
  GATOR_CLAWS,
  GATOR_LEDGE_OVERLAP_PX,
  gatorDisplaySize,
  gatorPeekLiftPx,
  NECK_BLEED_PX,
  NECK_MIRROR_OVERLAP_PX,
  neckMirrorStyle,
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

  it("scales claw size and offset when a custom scale is given", () => {
    const scale = 0.5;
    const style = clawsLayerStyle("neutral-happy", 200, scale);
    expect(style.width).toBe(CLAWS_ART.width * scale);
    expect(style.height).toBe(CLAWS_ART.height * scale);
    expect(style.top).toBe(200 - CLAWS_ART.cutoutFromTop * scale);
    expect(style.transform).toBe(
      `translateX(calc(-50% + ${GATOR_CLAWS["neutral-happy"].offsetX * scale}px))`,
    );
  });
});

describe("gatorDisplaySize", () => {
  it("uses the default art scale when none is given", () => {
    expect(gatorDisplaySize("sad")).toEqual({
      width: GATOR_ART.sad.width * GATOR_ART_SCALE,
      height: GATOR_ART.sad.height * GATOR_ART_SCALE,
    });
  });

  it("applies a custom scale", () => {
    expect(gatorDisplaySize("sad", 0.28)).toEqual({
      width: GATOR_ART.sad.width * 0.28,
      height: GATOR_ART.sad.height * 0.28,
    });
  });
});

describe("neckMirrorStyle", () => {
  it("overlaps the head so the mirrored neck hides the seam", () => {
    expect(neckMirrorStyle()).toEqual({
      height: NECK_BLEED_PX + NECK_MIRROR_OVERLAP_PX,
      top: `calc(100% - ${NECK_MIRROR_OVERLAP_PX}px)`,
    });
  });
});

describe("gatorPeekLiftPx", () => {
  it("subtracts the ledge overlap from the scaled head height", () => {
    expect(gatorPeekLiftPx("sad", 0.28)).toBe(
      GATOR_ART.sad.height * 0.28 - GATOR_LEDGE_OVERLAP_PX,
    );
  });
});
