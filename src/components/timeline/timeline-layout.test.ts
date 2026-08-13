import { describe, expect, it } from "vitest";
import {
  GRAPH_H,
  GRAPH_LANE_COUNT,
  graphCaptionTop,
  graphLabelTop,
  graphNodeCenter,
  NODE_CAPTION_H,
  NODE_HIT_PX,
  NODE_LABEL_H,
} from "@/components/timeline/timeline-layout";

describe("timeline graph layout", () => {
  it("keeps glyphs, captions, labels, and 44px hits inside GRAPH_H", () => {
    const hitR = NODE_HIT_PX / 2;
    for (const lane of [1, 0, -1] as const) {
      const { cy } = graphNodeCenter(0, lane);
      expect(cy - hitR).toBeGreaterThanOrEqual(0);
      expect(cy + hitR).toBeLessThanOrEqual(GRAPH_H);
      expect(graphCaptionTop(cy)).toBeGreaterThanOrEqual(0);
      expect(graphCaptionTop(cy) + NODE_CAPTION_H).toBeLessThan(cy);
      expect(graphLabelTop(cy)).toBeGreaterThan(cy);
      expect(graphLabelTop(cy) + NODE_LABEL_H).toBeLessThanOrEqual(GRAPH_H);
    }
  });

  it("leaves a gap between a lane label and the next lane glyph", () => {
    const upper = graphNodeCenter(0, 1);
    const trunk = graphNodeCenter(0, 0);
    expect(graphLabelTop(upper.cy) + NODE_LABEL_H).toBeLessThan(trunk.cy - 5);
    expect(GRAPH_LANE_COUNT).toBe(3);
  });
});
