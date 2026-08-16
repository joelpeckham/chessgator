import { describe, expect, it } from "vitest";
import { projectUciLine } from "@/domain/analysis";
import {
  createInitialTree,
  type GameTree,
  playMoveOnTree,
} from "@/domain/game";
import {
  analyzedNodeIdForFocus,
  buildTreeGraph,
  formatMoveLabel,
  lastHumanDecisionId,
} from "@/features/game/tree-graph";

function play(tree: GameTree, uci: string): GameTree {
  const result = playMoveOnTree(tree, tree.currentNodeId, uci);
  if (!result) throw new Error(`Illegal move ${uci}`);
  return result.tree;
}

function nodePos(
  graph: ReturnType<typeof buildTreeGraph>,
  id: string,
): { column: number | undefined; lane: number | undefined } {
  const node = graph.nodes.find((item) => item.id === id);
  return { column: node?.column, lane: node?.lane };
}

describe("formatMoveLabel", () => {
  it("formats start and both sides", () => {
    expect(formatMoveLabel(0, null)).toBe("start");
    expect(formatMoveLabel(1, "e4")).toBe("1.e4");
    expect(formatMoveLabel(2, "e5")).toBe("1…e5");
  });
});

describe("analyzedNodeIdForFocus", () => {
  it("returns the human ply, or its parent reply's human move", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    const e4 = tree.currentNodeId;
    tree = play(tree, "e7e5");
    expect(
      analyzedNodeIdForFocus({
        tree,
        focusNodeId: e4,
        humanColor: "w",
      }),
    ).toBe(e4);
    expect(
      analyzedNodeIdForFocus({
        tree,
        focusNodeId: tree.currentNodeId,
        humanColor: "w",
      }),
    ).toBe(e4);
    expect(lastHumanDecisionId(tree, "w")).toBe(e4);
  });
});

describe("buildTreeGraph", () => {
  it("keeps the first line on the start spine after a later branch is prepended", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    const e4 = tree.currentNodeId;
    tree = play(tree, "e7e5");
    const e5 = tree.currentNodeId;
    const fromStart = playMoveOnTree(tree, tree.rootId, "d2d4");
    if (!fromStart) throw new Error("Illegal move d2d4");
    tree = fromStart.tree;
    expect(tree.nodes[tree.rootId]?.childIds[0]).toBe(tree.currentNodeId);
    const graph = buildTreeGraph({
      tree,
      suggestedMove: null,
    });
    expect(nodePos(graph, e4).lane).toBe(0);
    expect(nodePos(graph, e5).lane).toBe(0);
    expect(nodePos(graph, tree.currentNodeId).lane).toBe(1);
  });

  it("keeps committed node lanes when the current node changes", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    const e4 = tree.currentNodeId;
    tree = play(tree, "e7e5");
    const atE5 = tree;
    const jumped = { ...tree, currentNodeId: e4 };
    const graphA = buildTreeGraph({
      tree: atE5,
      suggestedMove: null,
    });
    const graphB = buildTreeGraph({
      tree: jumped,
      suggestedMove: null,
    });
    expect(nodePos(graphA, e4)).toEqual(nodePos(graphB, e4));
    expect(nodePos(graphA, tree.rootId)).toEqual(nodePos(graphB, tree.rootId));
  });

  it("lays out a fork and overlays a single suggested move", () => {
    let tree = createInitialTree();
    tree = play(tree, "d2d4");
    const suggestedMove = projectUciLine({
      rootFen: tree.nodes[tree.rootId]!.fen,
      rootNodeId: tree.rootId,
      lineUci: ["e2e4", "e7e5"],
      maxPlies: 1,
    });
    const graph = buildTreeGraph({
      tree,
      suggestedMove,
    });
    expect(graph.nodes.some((node) => node.id === tree.rootId)).toBe(true);
    const suggested = graph.nodes.filter((node) => node.kind === "suggested");
    expect(suggested).toHaveLength(1);
    expect(suggested[0]?.san).toBe("e4");
    expect(suggested[0]?.uci).toBe("e2e4");
    expect(suggested[0]?.caption).toBe("Gator");
    expect(suggested[0]?.moveColor).toBe("w");
    expect(graph.nodes.find((node) => node.id === tree.rootId)?.uci).toBeNull();
    expect(
      graph.nodes.find((node) => node.id === tree.currentNodeId)?.uci,
    ).toBe("d2d4");
    expect(
      graph.nodes.find((node) => node.id === tree.currentNodeId)?.isCurrent,
    ).toBe(true);
    expect(
      graph.nodes.find((node) => node.id === tree.currentNodeId)?.moveColor,
    ).toBe("w");
  });

  it("skips a suggested move that already exists on the tree", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    const suggestedMove = projectUciLine({
      rootFen: tree.nodes[tree.rootId]!.fen,
      rootNodeId: tree.rootId,
      lineUci: ["e2e4"],
      maxPlies: 1,
    });
    const graph = buildTreeGraph({
      tree,
      suggestedMove,
    });
    expect(graph.nodes.some((node) => node.kind === "suggested")).toBe(false);
  });
});
