import { describe, expect, it } from "vitest";
import {
  createInitialTree,
  jumpToNode,
  playMoveOnTree,
} from "@/domain/game/tree";
import { playableLeafId } from "@/features/landing/hero-handoff";

describe("playableLeafId", () => {
  it("stays on a leaf", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    expect(playableLeafId(tree)).toBe(tree.currentNodeId);
  });

  it("walks forward from a review pointer to the live leaf", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4 = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4, "e7e5")!.tree;
    const e5 = tree.currentNodeId;
    tree = jumpToNode(tree, e4)!;
    expect(tree.currentNodeId).toBe(e4);
    expect(playableLeafId(tree)).toBe(e5);
  });
});
