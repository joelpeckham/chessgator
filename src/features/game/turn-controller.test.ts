import { describe, expect, it } from "vitest";
import { createInitialTree, playMoveOnTree } from "@/domain/game";
import {
  deriveBoardInteractivity,
  deriveOpponentTarget,
  opponentTargetKey,
} from "@/features/game/turn-controller";

describe("deriveOpponentTarget", () => {
  it("targets a leaf when it is Maia's turn", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const target = deriveOpponentTarget({
      liveMode: "opponentThinking",
      liveTree: tree,
    });
    expect(target).toEqual({
      nodeId: tree.currentNodeId,
      fen: tree.nodes[tree.currentNodeId]!.fen,
    });
    expect(opponentTargetKey(target)).toBe(tree.currentNodeId);
  });

  it("does not request a reply on an interior opponent-to-move node", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4 = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4, "e7e5")!.tree;
    tree = { ...tree, currentNodeId: e4 };
    expect(
      deriveOpponentTarget({
        liveMode: "opponentThinking",
        liveTree: tree,
      }),
    ).toBeNull();
  });
});

describe("deriveBoardInteractivity", () => {
  it("allows moves only on the human's turn", () => {
    const tree = createInitialTree();
    const fen = tree.nodes[tree.rootId]!.fen;
    expect(
      deriveBoardInteractivity({
        liveMode: "playerTurn",
        liveFen: fen,
        humanColor: "w",
        maiaFailed: false,
      }),
    ).toBe(true);
    expect(
      deriveBoardInteractivity({
        liveMode: "opponentThinking",
        liveFen: fen,
        humanColor: "w",
        maiaFailed: false,
      }),
    ).toBe(false);
  });
});
