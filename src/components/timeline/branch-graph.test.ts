import { describe, expect, it } from "vitest";
import { projectUciLine } from "@/domain/analysis/projected-lines";
import {
  buildBranchGraph,
  isVirtualTimelineId,
  parseVirtualTimelineId,
} from "@/components/timeline/branch-graph";
import {
  createInitialTree,
  jumpToNode,
  playMoveOnTree,
} from "@/domain/game";

describe("buildBranchGraph", () => {
  it("places mainline on lane 0 and sibling branches on side lanes", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;

    const graph = buildBranchGraph({ tree });
    const d4 = graph.nodes.find((n) => n.id === d4Id);
    const e4 = graph.nodes.find((n) => n.id === e4Id);
    const root = graph.nodes.find((n) => n.id === tree.rootId);

    expect(root?.lane).toBe(0);
    expect(d4?.lane).toBe(0);
    expect(d4?.isLive).toBe(true);
    expect(e4?.lane).not.toBe(0);
    expect(e4?.column).toBe(1);
  });

  it("attaches projected future on the main lane", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const future = projectUciLine({
      rootFen: tree.nodes[tree.currentNodeId]!.fen,
      rootNodeId: tree.currentNodeId,
      lineUci: ["e7e5", "g1f3"],
      kind: "future",
    });

    const graph = buildBranchGraph({ tree, futureLine: future });
    const projected = graph.nodes.filter((n) => n.kind === "projected");
    expect(projected).toHaveLength(2);
    expect(projected.every((n) => n.lane === 0)).toBe(true);
    expect(projected.every((n) => isVirtualTimelineId(n.id))).toBe(true);
  });

  it("attaches tutor alternate on a side lane", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const tutor = projectUciLine({
      rootFen: tree.nodes[tree.rootId]!.fen,
      rootNodeId: tree.rootId,
      lineUci: ["e2e4", "e7e5"],
      kind: "tutor",
    });

    const graph = buildBranchGraph({ tree, tutorLine: tutor });
    const tutorNodes = graph.nodes.filter((n) => n.kind === "tutor");
    expect(tutorNodes.length).toBeGreaterThan(0);
    expect(tutorNodes[0]?.lane).not.toBe(0);
    const parsed = parseVirtualTimelineId(tutorNodes[0]!.id);
    expect(parsed?.kind).toBe("tutor");
    expect(parsed?.uciPath[0]).toBe("e2e4");
  });

  it("keeps a tutor line on one sticky lane (no zig-zag)", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    // Sibling on +1; tutor must pick another side lane and stay there.
    const tutor = projectUciLine({
      rootFen: tree.nodes[tree.rootId]!.fen,
      rootNodeId: tree.rootId,
      lineUci: ["c2c4", "e7e5", "g1f3"],
      kind: "tutor",
    });

    const graph = buildBranchGraph({ tree, tutorLine: tutor });
    const tutorNodes = graph.nodes.filter((n) => n.kind === "tutor");
    expect(tutorNodes.length).toBe(3);
    const lane = tutorNodes[0]!.lane;
    expect(lane).not.toBe(0);
    expect(tutorNodes.every((n) => n.lane === lane)).toBe(true);
    // Sibling variation still placed (e4), not colliding with tutor.
    expect(graph.nodes.some((n) => n.id === e4Id && n.lane !== 0)).toBe(true);
  });

  it("does not stack projected future on an occupied main-line slot", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4Id, "e7e5")!.tree;
    const e5Id = tree.currentNodeId;

    // Future rooted behind the tip with a different first move than the live child.
    const future = projectUciLine({
      rootFen: tree.nodes[e4Id]!.fen,
      rootNodeId: e4Id,
      lineUci: ["c7c5", "g1f3"],
      kind: "future",
    });

    const graph = buildBranchGraph({ tree, futureLine: future });
    const live = graph.nodes.find((n) => n.id === e5Id)!;
    const projected = graph.nodes.filter((n) => n.kind === "projected");
    expect(projected.length).toBe(2);
    for (const node of projected) {
      expect(
        graph.nodes.some(
          (other) =>
            other.id !== node.id &&
            other.column === node.column &&
            other.lane === node.lane,
        ),
      ).toBe(false);
    }
    // Divergent first ply must not share the live tip's column+lane.
    const first = projected.find((n) => n.uciFromParent === "c7c5")!;
    expect(first.column).toBe(live.column);
    expect(first.lane).not.toBe(live.lane);
    expect(projected.every((n) => n.lane === first.lane)).toBe(true);
  });

  it("marks review cursor independently of live playhead", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4Id, "e7e5")!.tree;

    const graph = buildBranchGraph({
      tree,
      reviewNodeId: e4Id,
    });
    const e4 = graph.nodes.find((n) => n.id === e4Id);
    const tip = graph.nodes.find((n) => n.id === tree.currentNodeId);
    expect(e4?.isReview).toBe(true);
    expect(e4?.isLive).toBe(false);
    expect(tip?.isLive).toBe(true);
    expect(tip?.isReview).toBe(false);
  });
});
