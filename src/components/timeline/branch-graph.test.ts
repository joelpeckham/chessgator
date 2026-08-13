import { describe, expect, it } from "vitest";
import {
  buildBranchGraph,
  isVirtualTimelineId,
  LANE,
  parseVirtualTimelineId,
  pinOverflowBranch,
  transportStep,
} from "@/components/timeline/branch-graph";
import { projectUciLine } from "@/domain/analysis/projected-lines";
import { createInitialTree, jumpToNode, playMoveOnTree } from "@/domain/game";

function assertNoCollisions(graph: ReturnType<typeof buildBranchGraph>): void {
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    const key = `${node.column}:${node.lane}`;
    expect(seen.has(key), `collision at ${key}`).toBe(false);
    seen.add(key);
  }
}

function assertNoZigZag(graph: ReturnType<typeof buildBranchGraph>): void {
  const byBranch = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.isOverflow) continue;
    const existing = byBranch.get(node.branchKey);
    if (existing == null) {
      byBranch.set(node.branchKey, node.lane);
    } else {
      expect(node.lane).toBe(existing);
    }
  }
}

describe("buildBranchGraph", () => {
  it("places mainline on lane 0 and sibling branches on variation lanes", () => {
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

    expect(root?.lane).toBe(LANE.played);
    expect(d4?.lane).toBe(LANE.played);
    expect(d4?.isLive).toBe(true);
    expect(e4?.lane).not.toBe(LANE.played);
    expect(Math.abs(e4?.lane ?? 0)).toBe(2);
    expect(e4?.column).toBe(1);
    expect(e4?.moveLabel).toBe("1.e4");
    assertNoCollisions(graph);
    assertNoZigZag(graph);
  });

  it("attaches projected future on the engine lane after the live tip", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    tree = playMoveOnTree(tree, tree.currentNodeId, "e7e5")!.tree;
    // White to move — engine line starts with White's continuation.
    const future = projectUciLine({
      rootFen: tree.nodes[tree.currentNodeId]!.fen,
      rootNodeId: tree.currentNodeId,
      lineUci: ["g1f3", "b8c6"],
      kind: "future",
    });

    const graph = buildBranchGraph({ tree, futureLine: future });
    const projected = graph.nodes.filter((n) => n.kind === "projected");
    expect(projected).toHaveLength(2);
    expect(projected.every((n) => n.lane === LANE.engine)).toBe(true);
    expect(projected.every((n) => n.column > graph.liveTipColumn)).toBe(true);
    expect(projected.every((n) => isVirtualTimelineId(n.id))).toBe(true);
    assertNoCollisions(graph);
  });

  it("hides engine future when the live tip is Black to move", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const future = projectUciLine({
      rootFen: tree.nodes[tree.currentNodeId]!.fen,
      rootNodeId: tree.currentNodeId,
      lineUci: ["e7e5", "g1f3"],
      kind: "future",
    });

    const graph = buildBranchGraph({ tree, futureLine: future });
    expect(graph.nodes.some((n) => n.kind === "projected")).toBe(false);
  });

  it("shows engine future when the human is Black and Black is to move", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const future = projectUciLine({
      rootFen: tree.nodes[tree.currentNodeId]!.fen,
      rootNodeId: tree.currentNodeId,
      lineUci: ["e7e5", "g1f3"],
      kind: "future",
    });

    const graph = buildBranchGraph({
      tree,
      futureLine: future,
      humanColor: "b",
    });
    const projected = graph.nodes.filter((n) => n.kind === "projected");
    expect(projected.length).toBeGreaterThan(0);
    expect(projected.every((n) => n.lane === LANE.engine)).toBe(true);
  });

  it("attaches coach alternate on the coach lane", () => {
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
    expect(tutorNodes.every((n) => n.lane === LANE.coach)).toBe(true);
    const parsed = parseVirtualTimelineId(tutorNodes[0]!.id);
    expect(parsed?.kind).toBe("tutor");
    expect(parsed?.uciPath[0]).toBe("e2e4");
  });

  it("keeps a coach line on one sticky lane (no zig-zag)", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const tutor = projectUciLine({
      rootFen: tree.nodes[tree.rootId]!.fen,
      rootNodeId: tree.rootId,
      lineUci: ["c2c4", "e7e5", "g1f3"],
      kind: "tutor",
    });

    const graph = buildBranchGraph({ tree, tutorLine: tutor });
    const tutorNodes = graph.nodes.filter((n) => n.kind === "tutor");
    expect(tutorNodes.length).toBe(3);
    expect(tutorNodes.every((n) => n.lane === LANE.coach)).toBe(true);
    expect(graph.nodes.some((n) => n.id === e4Id && n.lane !== 0)).toBe(true);
    assertNoZigZag(graph);
  });

  it("does not show a future rooted behind the live tip", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4Id, "e7e5")!.tree;
    const e5Id = tree.currentNodeId;

    // Stale future rooted at e4 (Black to move) must not appear at the e5 tip.
    const future = projectUciLine({
      rootFen: tree.nodes[e4Id]!.fen,
      rootNodeId: e4Id,
      lineUci: ["c7c5", "g1f3"],
      kind: "future",
    });

    const graph = buildBranchGraph({ tree, futureLine: future });
    const live = graph.nodes.find((n) => n.id === e5Id)!;
    expect(live.lane).toBe(LANE.played);
    expect(graph.nodes.some((n) => n.kind === "projected")).toBe(false);
    assertNoCollisions(graph);
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
    expect(graph.reviewPath).toContain(e4Id);
  });

  it("hides engine future while reviewing a non-live node", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4Id, "e7e5")!.tree;
    const future = projectUciLine({
      rootFen: tree.nodes[tree.currentNodeId]!.fen,
      rootNodeId: tree.currentNodeId,
      lineUci: ["g1f3", "b8c6"],
      kind: "future",
    });

    const liveGraph = buildBranchGraph({ tree, futureLine: future });
    expect(liveGraph.nodes.some((n) => n.kind === "projected")).toBe(true);

    const reviewGraph = buildBranchGraph({
      tree,
      futureLine: future,
      reviewNodeId: e4Id,
    });
    expect(reviewGraph.nodes.some((n) => n.kind === "projected")).toBe(false);
  });

  it("lists overflow branches and expands a pinned key", () => {
    let tree = createInitialTree();
    // Live mainline: d4
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    // Create many root siblings: e4, c4, Nf3, e3, c3
    const alts = ["e2e4", "c2c4", "g1f3", "e2e3", "c2c3"];
    for (const uci of alts) {
      tree = jumpToNode(tree, tree.rootId)!;
      tree = playMoveOnTree(tree, tree.rootId, uci)!.tree;
    }
    // Return live to d4
    const d4 = Object.values(tree.nodes).find((n) => n.move?.uci === "d2d4")!;
    tree = jumpToNode(tree, d4.id)!;

    const graph = buildBranchGraph({ tree, maxLaneSide: 2 });
    expect(graph.overflowGroups.length).toBeGreaterThan(0);
    const group = graph.overflowGroups[0]!;
    expect(group.hiddenBranches.length).toBeGreaterThan(0);
    const hub = graph.nodes.find((n) => n.isOverflow);
    expect(hub).toBeTruthy();
    expect(hub?.san).toMatch(/^\+\d+$/);

    const pin = group.hiddenBranches[0]!;
    const expanded = buildBranchGraph({
      tree,
      maxLaneSide: 2,
      expandedOverflowKeys: [pin.branchKey],
    });
    expect(expanded.nodes.some((n) => n.id === pin.headNodeId)).toBe(true);
    assertNoCollisions(expanded);
  });

  it("transportStep follows the selected variation, not the mainline", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4Id, "e7e5")!.tree;
    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, d4Id, "d7d5")!.tree;
    // Jump live back? Keep d5 as live. Review e4 branch.
    // Actually live is d5. Review e4.
    const graph = buildBranchGraph({ tree, reviewNodeId: e4Id });
    expect(graph.reviewPath).toContain(e4Id);
    expect(graph.reviewPath).not.toContain(d4Id);

    const prev = transportStep(graph, e4Id, -1);
    expect(prev).toBe(tree.rootId);
    const next = transportStep(graph, e4Id, 1);
    // e4's child on that branch is e5
    expect(next).toBeTruthy();
    const nextNode = graph.nodes.find((n) => n.id === next);
    expect(nextNode?.san).toBe("e5");
  });

  it("lane assignment is independent of reviewNodeId", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;

    const a = buildBranchGraph({ tree });
    const b = buildBranchGraph({ tree, reviewNodeId: e4Id });
    const lanesA = a.nodes
      .filter((n) => !n.isOverflow)
      .map((n) => `${n.id}:${n.lane}`)
      .toSorted();
    const lanesB = b.nodes
      .filter((n) => !n.isOverflow)
      .map((n) => `${n.id}:${n.lane}`)
      .toSorted();
    expect(lanesA).toEqual(lanesB);
  });
});

describe("pinOverflowBranch", () => {
  it("keeps at most maxLaneSide pins under the same parent", () => {
    const keys = pinOverflowBranch({
      expandedOverflowKeys: ["var:p1:e2e4", "var:p2:a2a4"],
      parentId: "p1",
      branchKey: "var:p1:d2d4",
      maxLaneSide: 1,
    });
    expect(keys).toEqual(["var:p2:a2a4", "var:p1:d2d4"]);
  });
});
