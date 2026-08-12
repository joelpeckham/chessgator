import { describe, expect, it } from "vitest";
import {
  createGameSession,
  createVariationExplorer,
  exitVariationExplorer,
  getMainlinePath,
  jumpToGameNode,
  listMainlineChild,
  playMove,
  stepVariationBack,
  stepVariationForward,
  tryInsteadFromExplorer,
  validateVariationLine,
} from "@/domain/game";
import { DEFAULT_POSITION } from "@/domain/game/rules";

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
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    game = playMove(game, "e7e5").session;
    const originId = game.tree.currentNodeId;
    const mainChildBefore = listMainlineChild(game.tree, game.tree.rootId);

    const started = createVariationExplorer(game.tree, originId, [
      "g1f3",
      "b8c6",
    ]);
    expect(started).not.toBeNull();
    let tree = started!.tree;
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

    // Main line from the root is unchanged (still e4).
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
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    const afterE4 = game.tree.currentNodeId;

    // Explore an alternate from the root while keeping e4.
    game = jumpToGameNode(game, game.tree.rootId).session;
    const started = createVariationExplorer(game.tree, game.tree.rootId, [
      "d2d4",
      "d7d5",
    ]);
    expect(started).not.toBeNull();
    let tree = started!.tree;
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

    // e4 branch preserved; d4 is now the preferred mainline child.
    const root = tried!.tree.nodes[tried!.tree.rootId]!;
    expect(root.childIds).toContain(afterE4);
    expect(listMainlineChild(tried!.tree, root.id)?.id).toBe(tried!.node.id);
    expect(
      Object.values(tried!.tree.nodes).some((n) => n.isVariation),
    ).toBe(false);
  });

  it("exit removes nested ghosts when first ply reused a committed child", () => {
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    const e4Id = game.tree.currentNodeId;
    game = playMove(game, "e7e5").session;
    const e5Id = game.tree.currentNodeId;
    // Legitimate committed descendant under e5 (must survive exit).
    game = playMove(game, "b1c3").session;
    const committedNc3Id = game.tree.currentNodeId;

    // Explore from root: first ply reuses committed e4, then nested ghosts.
    const started = createVariationExplorer(game.tree, game.tree.rootId, [
      "e2e4",
      "e7e5",
      "g1f3",
      "b8c6",
    ]);
    expect(started).not.toBeNull();
    let tree = started!.tree;
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
    expect(exited.currentNodeId).toBe(game.tree.rootId);
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

  it("preserves branches when jumping / taking back after exploration", () => {
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    game = playMove(game, "e7e5").session;
    const leaf = game.tree.currentNodeId;
    const count = Object.keys(game.tree.nodes).length;

    game = jumpToGameNode(game, game.tree.rootId).session;
    game = playMove(game, "d2d4").session;
    expect(Object.keys(game.tree.nodes).length).toBeGreaterThan(count);

    game = jumpToGameNode(game, leaf).session;
    expect(game.tree.currentNodeId).toBe(leaf);
    expect(game.tree.nodes[leaf]?.move?.uci).toBe("e7e5");
  });

  it("blunder explore line + Try instead commits suggestedMoveUci, not the mistake", () => {
    // Simulate a position where White blundered a2a3 instead of h5e5.
    const fenBefore =
      "rnbqkbnr/pppp1p1p/6p1/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3";
    let game = createGameSession({ fen: fenBefore });
    game = playMove(game, "a2a3").session;
    const blunderId = game.tree.currentNodeId;
    const originId = game.tree.rootId;

    const improvement = ["h5e5", "d7d6"];
    const started = createVariationExplorer(game.tree, originId, improvement);
    expect(started).not.toBeNull();
    let tree = started!.tree;
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
    // Prior blunder branch remains visible as a sibling.
    expect(
      tried!.tree.nodes[originId]!.childIds.some(
        (id) => tried!.tree.nodes[id]?.move?.uci === "a2a3",
      ),
    ).toBe(true);
  });
});
