import { describe, expect, it } from "vitest";
import {
  EXPANDED_GRAPH_H,
  graphCaptionTop,
  graphContentHeight,
  graphLabelTop,
  graphNodeCenter,
  horizontalCenterOffset,
  type LayoutInputNode,
  layoutTree,
  NODE_CAPTION_H,
  NODE_HIT_PX,
  NODE_LABEL_H,
  nearestFreeLane,
  STRIP_GRAPH_H,
  STRIP_LANE_COUNT,
  verticalCenterOffset,
} from "@/components/timeline/tree-layout";

function node(
  id: string,
  parentId: string | null,
  ply: number,
  childIds: string[],
): LayoutInputNode {
  return { id, parentId, ply, childIds };
}

describe("layoutTree", () => {
  it("keeps the oldest child on the start spine and forks later siblings", () => {
    const nodes = {
      root: node("root", null, 0, ["e4", "d4"]),
      e4: node("e4", "root", 1, ["e5"]),
      e5: node("e5", "e4", 2, []),
      d4: node("d4", "root", 1, []),
    };
    const layout = layoutTree(nodes, "root");
    expect(layout.positions.get("root")?.lane).toBe(0);
    expect(layout.positions.get("e4")?.lane).toBe(0);
    expect(layout.positions.get("e5")?.lane).toBe(0);
    expect(layout.positions.get("d4")?.lane).toBe(1);
    expect(layout.positions.get("d4")?.column).toBe(1);
    expect(layout.columns).toBe(3);
  });

  it("does not steal the start spine when a newer child is listed first", () => {
    const nodes = {
      root: node("root", null, 0, ["d4", "e4"]),
      e4: node("e4", "root", 1, ["e5"]),
      e5: node("e5", "e4", 2, []),
      d4: node("d4", "root", 1, []),
    };
    const bornAt = new Map([
      ["root", 0],
      ["e4", 1],
      ["e5", 2],
      ["d4", 3],
    ]);
    const layout = layoutTree(nodes, "root", bornAt);
    expect(layout.positions.get("e4")?.lane).toBe(0);
    expect(layout.positions.get("e5")?.lane).toBe(0);
    expect(layout.positions.get("d4")?.lane).toBe(1);
  });

  it("puts the first fork from the start line above, the next below", () => {
    const nodes = {
      root: node("root", null, 0, ["e4", "d4", "c4"]),
      e4: node("e4", "root", 1, []),
      d4: node("d4", "root", 1, []),
      c4: node("c4", "root", 1, []),
    };
    const layout = layoutTree(nodes, "root");
    expect(layout.positions.get("e4")?.lane).toBe(0);
    expect(layout.positions.get("d4")?.lane).toBe(1);
    expect(layout.positions.get("c4")?.lane).toBe(-1);
  });

  it("forks a side line toward the start spine on a tie", () => {
    const nodes = {
      root: node("root", null, 0, ["e4", "d4"]),
      e4: node("e4", "root", 1, []),
      d4: node("d4", "root", 1, ["d5", "nf6"]),
      d5: node("d5", "d4", 2, []),
      nf6: node("nf6", "d4", 2, []),
    };
    const layout = layoutTree(nodes, "root");
    expect(layout.positions.get("d4")?.lane).toBe(1);
    expect(layout.positions.get("d5")?.lane).toBe(1);
    expect(layout.positions.get("nf6")?.lane).toBe(-1);
  });
});

describe("timeline graph geometry", () => {
  it("keeps glyphs, captions, labels, and 44px hits inside a 3-lane strip", () => {
    const hitR = NODE_HIT_PX / 2;
    const maxLane = 1;
    for (const lane of [1, 0, -1]) {
      const { cy } = graphNodeCenter(0, lane, maxLane);
      expect(cy - hitR).toBeGreaterThanOrEqual(0);
      expect(cy + hitR).toBeLessThanOrEqual(STRIP_GRAPH_H);
      expect(graphCaptionTop(cy)).toBeGreaterThanOrEqual(0);
      expect(graphCaptionTop(cy) + NODE_CAPTION_H).toBeLessThan(cy);
      expect(graphLabelTop(cy)).toBeGreaterThan(cy);
      expect(graphLabelTop(cy) + NODE_LABEL_H).toBeLessThanOrEqual(
        STRIP_GRAPH_H,
      );
    }
    expect(STRIP_LANE_COUNT).toBe(3);
    expect(graphContentHeight(-1, 1)).toBe(STRIP_GRAPH_H);
  });

  it("centers a wide tree on the current column without leaving the content", () => {
    const content = 15 * 60;
    const offset = horizontalCenterOffset(8 * 60 + 30, content, 320);
    expect(offset).toBeLessThanOrEqual(0);
    expect(offset).toBeGreaterThanOrEqual(320 - content);
    expect(horizontalCenterOffset(30, 320, 320)).toBe(0);
  });

  it("always places the current node on the viewport midline", () => {
    const { cy: topCy } = graphNodeCenter(0, 1, 1);
    const { cy: midCy } = graphNodeCenter(0, 0, 1);
    expect(topCy + verticalCenterOffset(topCy, STRIP_GRAPH_H)).toBe(
      STRIP_GRAPH_H / 2,
    );
    expect(midCy + verticalCenterOffset(midCy, STRIP_GRAPH_H)).toBe(
      STRIP_GRAPH_H / 2,
    );
    const { cy: shortCy } = graphNodeCenter(0, 0, 0);
    expect(shortCy + verticalCenterOffset(shortCy, EXPANDED_GRAPH_H)).toBe(
      EXPANDED_GRAPH_H / 2,
    );
  });

  it("picks the nearest unused signed lane", () => {
    expect(nearestFreeLane(new Set([0]), 0)).toBe(1);
    expect(nearestFreeLane(new Set([0, 1]), 0)).toBe(-1);
    expect(nearestFreeLane(new Set([1]), 1)).toBe(2);
  });
});
