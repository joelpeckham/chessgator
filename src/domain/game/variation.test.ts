import { describe, expect, it } from "vitest";
import {
  createInitialTree,
  createVariationExplorer,
  exitVariationExplorer,
  getMainlinePath,
  jumpToNode,
  listMainlineChild,
  playMoveOnTree,
  stepVariationBack,
  stepVariationForward,
  tryInsteadFromExplorer,
  validateVariationLine,
} from "@/domain/game";
import { DEFAULT_POSITION } from "@/domain/game/rules";
import type { GameTree } from "@/domain/game/types";

function play(tree: GameTree, uci: string): GameTree {
  const result = playMoveOnTree(tree, tree.currentNodeId, uci);
  if (!result) throw new Error(`Illegal move ${uci}`);
  return result.tree;
}

describe("variation explorer", () => {
  it("validates a Stockfish-style UCI line and stops on illegals", () => {
    const line = validateVariationLine(DEFAULT_POSITION, [
      "e2e4",
      "e7e5",
      "g1f3",
      "not-a-move",
      "d2d4",
    ]);
    expect(line).toEqual(["e2e4", "e7e5", "g1f3"]);
  });

  it("steps through ghost nodes without stealing the main line", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    tree = play(tree, "e7e5");
    const originId = tree.currentNodeId;
    const mainChildBefore = listMainlineChild(tree, tree.rootId);

    const started = createVariationExplorer(tree, originId, [
      "g1f3",
      "b8c6",
    ]);
    expect(started).not.toBeNull();
    tree = started!.tree;
    let explorer = started!.explorer;

    const fwd1 = stepVariationForward(tree, explorer);
    expect(fwd1).not.toBeNull();
    tree = fwd1!.tree;
    explorer = fwd1!.explorer;
    expect(explorer.stepIndex).toBe(1);
    expect(tree.nodes[tree.currentNodeId]!.isVariation).toBe(true);

    const fwd2 = stepVariationForward(tree, explorer);
    expect(fwd2).not.toBeNull();
    tree = fwd2!.tree;
    explorer = fwd2!.explorer;
    expect(explorer.stepIndex).toBe(2);

    expect(listMainlineChild(tree, tree.rootId)?.id).toBe(mainChildBefore?.id);
    expect(getMainlinePath(tree).map((n) => n.move?.uci)).toEqual([
      undefined,
      "e2e4",
      "e7e5",
    ]);

    const back = stepVariationBack(tree, explorer);
    expect(back).not.toBeNull();
    expect(back!.explorer.stepIndex).toBe(1);

    const exited = exitVariationExplorer(back!.tree, back!.explorer);
    expect(exited.currentNodeId).toBe(originId);
    expect(
      Object.values(exited.nodes).some((n) => n.isVariation),
    ).toBe(false);
  });

  it("Try instead promotes the first ply and restores a clean origin sibling set", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    const afterE4 = tree.currentNodeId;

    tree = jumpToNode(tree, tree.rootId)!;
    const started = createVariationExplorer(tree, tree.rootId, [
      "d2d4",
      "d7d5",
    ]);
    expect(started).not.toBeNull();
    tree = started!.tree;
    let explorer = started!.explorer;
    const stepped = stepVariationForward(tree, explorer);
    expect(stepped).not.toBeNull();
    tree = stepped!.tree;
    explorer = stepped!.explorer;

    const tried = tryInsteadFromExplorer(tree, explorer);
    expect(tried).not.toBeNull();
    expect(tried!.node.move?.uci).toBe("d2d4");
    expect(tried!.node.isVariation).toBe(false);
    expect(tried!.tree.currentNodeId).toBe(tried!.node.id);

    const root = tried!.tree.nodes[tried!.tree.rootId]!;
    expect(root.childIds).toContain(afterE4);
    expect(listMainlineChild(tried!.tree, root.id)?.id).toBe(tried!.node.id);
    expect(
      Object.values(tried!.tree.nodes).some((n) => n.isVariation),
    ).toBe(false);
  });

  it("exit removes nested ghosts when first ply reused a committed child", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    const e4Id = tree.currentNodeId;
    tree = play(tree, "e7e5");
    const e5Id = tree.currentNodeId;
    tree = play(tree, "b1c3");
    const committedNc3Id = tree.currentNodeId;
    const rootId = tree.rootId;

    const started = createVariationExplorer(tree, rootId, [
      "e2e4",
      "e7e5",
      "g1f3",
      "b8c6",
    ]);
    expect(started).not.toBeNull();
    tree = started!.tree;
    let explorer = started!.explorer;

    for (let i = 0; i < 4; i += 1) {
      const advanced = stepVariationForward(tree, explorer);
      expect(advanced).not.toBeNull();
      tree = advanced!.tree;
      explorer = advanced!.explorer;
    }
    expect(explorer.stepIndex).toBe(4);
    expect(explorer.pathNodeIds[1]).toBe(e4Id);
    expect(tree.nodes[e4Id]?.isVariation).toBe(false);
    expect(tree.nodes[e5Id]?.isVariation).toBe(false);

    const ghostIds = explorer.pathNodeIds
      .slice(1)
      .filter((id) => tree.nodes[id]?.isVariation);
    expect(ghostIds.length).toBeGreaterThan(0);

    const exited = exitVariationExplorer(tree, explorer);
    expect(exited.currentNodeId).toBe(rootId);
    expect(exited.nodes[e4Id]).toBeDefined();
    expect(exited.nodes[e5Id]).toBeDefined();
    expect(exited.nodes[committedNc3Id]).toBeDefined();
    expect(exited.nodes[committedNc3Id]?.isVariation).toBe(false);
    for (const id of ghostIds) {
      expect(exited.nodes[id]).toBeUndefined();
    }
    expect(
      Object.values(exited.nodes).some((n) => n.isVariation),
    ).toBe(false);
  });

  it("preserves branches when jumping after exploration", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    tree = play(tree, "e7e5");
    const leaf = tree.currentNodeId;
    const count = Object.keys(tree.nodes).length;

    tree = jumpToNode(tree, tree.rootId)!;
    tree = play(tree, "d2d4");
    expect(Object.keys(tree.nodes).length).toBeGreaterThan(count);

    tree = jumpToNode(tree, leaf)!;
    expect(tree.currentNodeId).toBe(leaf);
    expect(tree.nodes[leaf]?.move?.uci).toBe("e7e5");
  });

  it("blunder explore line + Try instead commits suggestedMoveUci, not the mistake", () => {
    const fenBefore =
      "rnbqkbnr/pppp1p1p/6p1/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3";
    let tree = createInitialTree(fenBefore);
    tree = play(tree, "a2a3");
    const blunderId = tree.currentNodeId;
    const originId = tree.rootId;

    const improvement = ["h5e5", "d7d6"];
    const started = createVariationExplorer(tree, originId, improvement);
    expect(started).not.toBeNull();
    tree = started!.tree;
    let explorer = started!.explorer;
    const stepped = stepVariationForward(tree, explorer);
    expect(stepped).not.toBeNull();
    tree = stepped!.tree;
    explorer = stepped!.explorer;
    expect(explorer.lineUci[0]).toBe("h5e5");
    expect(explorer.lineUci[0]).not.toBe("a2a3");

    const tried = tryInsteadFromExplorer(tree, explorer, {
      commitUci: "h5e5",
    });
    expect(tried).not.toBeNull();
    expect(tried!.node.move?.uci).toBe("h5e5");
    expect(tried!.node.id).not.toBe(blunderId);
    expect(listMainlineChild(tried!.tree, originId)?.move?.uci).toBe("h5e5");
    expect(
      tried!.tree.nodes[originId]!.childIds.some(
        (id) => tried!.tree.nodes[id]?.move?.uci === "a2a3",
      ),
    ).toBe(true);
  });
});
