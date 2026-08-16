import { describe, expect, it } from "vitest";
import { projectUciLine } from "@/domain/analysis";
import {
  createInitialTree,
  type GameTree,
  playMoveOnTree,
} from "@/domain/game";
import { resolveBoardPreview } from "@/features/game/board-preview";
import { buildTreeGraph } from "@/features/game/tree-graph";

function play(tree: GameTree, uci: string): GameTree {
  const result = playMoveOnTree(tree, tree.currentNodeId, uci);
  if (!result) throw new Error(`Illegal move ${uci}`);
  return result.tree;
}

describe("resolveBoardPreview", () => {
  it("returns null for a missing hover or the focused node", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    const graph = buildTreeGraph({ tree, suggestedMove: null });
    expect(resolveBoardPreview(graph, null, tree.currentNodeId)).toBeNull();
    expect(
      resolveBoardPreview(graph, tree.currentNodeId, tree.currentNodeId),
    ).toBeNull();
  });

  it("returns fen and last move for another committed node", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    const e4 = tree.currentNodeId;
    const e4Fen = tree.nodes[e4]!.fen;
    tree = play(tree, "e7e5");
    const graph = buildTreeGraph({ tree, suggestedMove: null });
    expect(resolveBoardPreview(graph, e4, tree.currentNodeId)).toEqual({
      fen: e4Fen,
      lastMove: { from: "e2", to: "e4" },
      isCheck: false,
      checkSquare: null,
    });
  });

  it("returns a suggested virtual node's fen", () => {
    let tree = createInitialTree();
    tree = play(tree, "d2d4");
    const suggestedMove = projectUciLine({
      rootFen: tree.nodes[tree.rootId]!.fen,
      rootNodeId: tree.rootId,
      lineUci: ["e2e4", "e7e5"],
      maxPlies: 1,
    });
    const graph = buildTreeGraph({ tree, suggestedMove });
    const suggested = graph.nodes.find((node) => node.kind === "suggested");
    expect(suggested).toBeDefined();
    expect(
      resolveBoardPreview(graph, suggested!.id, tree.currentNodeId),
    ).toEqual({
      fen: suggested!.fen,
      lastMove: { from: "e2", to: "e4" },
      isCheck: false,
      checkSquare: null,
    });
  });

  it("returns null for an unknown id", () => {
    const tree = createInitialTree();
    const graph = buildTreeGraph({ tree, suggestedMove: null });
    expect(
      resolveBoardPreview(graph, "missing", tree.currentNodeId),
    ).toBeNull();
  });
});
