import { describe, expect, it } from "vitest";
import {
  createGameSession,
  getAncestors,
  getMoveHistory,
  getStatusAtNode,
  jumpToGameNode,
  listMainlineChild,
  playMove,
  retryMove,
  takeback,
} from "@/domain/game";
import {
  createBootstrapTree,
  createInitialTree,
  playMoveOnTree,
} from "@/domain/game/tree";

describe("game tree", () => {
  it("keeps the bootstrap root ID stable", () => {
    const first = createBootstrapTree();
    const second = createBootstrapTree();

    expect(first.rootId).toBe("root");
    expect(second.rootId).toBe(first.rootId);
    expect(first.currentNodeId).toBe(first.rootId);
  });

  it("creates a root node and plays moves immutably", () => {
    const tree = createInitialTree();
    const rootId = tree.rootId;
    const played = playMoveOnTree(tree, rootId, "e2e4");
    expect(played).not.toBeNull();
    expect(played!.created).toBe(true);
    expect(played!.tree.nodes[rootId]!.childIds).toHaveLength(1);
    expect(tree.nodes[rootId]!.childIds).toHaveLength(0); // original unchanged
    expect(getMoveHistory(played!.tree, played!.node.id).map((m) => m.uci)).toEqual([
      "e2e4",
    ]);
  });

  it("reuses an existing branch when the same move is replayed", () => {
    let game = createGameSession();
    const first = playMove(game, "e2e4");
    expect(first.ok).toBe(true);
    game = first.session;
    const childId = game.tree.currentNodeId;

    const jumped = jumpToGameNode(game, game.tree.rootId);
    expect(jumped.ok).toBe(true);
    game = jumped.session;

    const again = playMove(game, "e2e4");
    expect(again.ok).toBe(true);
    expect(again.session.tree.currentNodeId).toBe(childId);
    expect(Object.keys(again.session.tree.nodes)).toHaveLength(
      Object.keys(game.tree.nodes).length,
    );
  });

  it("creates a sibling branch for an alternate move", () => {
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    const e4Node = game.tree.currentNodeId;

    game = jumpToGameNode(game, game.tree.rootId).session;
    game = playMove(game, "d2d4").session;

    const root = game.tree.nodes[game.tree.rootId]!;
    expect(root.childIds).toHaveLength(2);
    expect(root.childIds).toContain(e4Node);
    expect(root.childIds).toContain(game.tree.currentNodeId);
    expect(e4Node).not.toBe(game.tree.currentNodeId);
  });

  it("makes a newly committed alternate the preferred mainline child", () => {
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    const e4Node = game.tree.currentNodeId;

    game = jumpToGameNode(game, game.tree.rootId).session;
    game = playMove(game, "d2d4").session;
    const d4Node = game.tree.currentNodeId;

    const root = game.tree.nodes[game.tree.rootId]!;
    expect(root.childIds[0]).toBe(d4Node);
    expect(listMainlineChild(game.tree, root.id)?.id).toBe(d4Node);
    // Prior e4 branch is preserved and not the preferred child while on d4.
    expect(root.childIds).toContain(e4Node);
    expect(game.tree.nodes[e4Node]?.move?.uci).toBe("e2e4");
  });

  it("getAncestors stops on parent cycles instead of hanging", () => {
    const tree = createInitialTree();
    const rootId = tree.rootId;
    const a = "node-a";
    const b = "node-b";
    const cyclic = {
      ...tree,
      nodes: {
        ...tree.nodes,
        [a]: {
          id: a,
          parentId: b,
          childIds: [],
          fen: tree.nodes[rootId]!.fen,
          move: null,
          ply: 1,
          analysis: null,
          isVariation: false,
        },
        [b]: {
          id: b,
          parentId: a,
          childIds: [],
          fen: tree.nodes[rootId]!.fen,
          move: null,
          ply: 2,
          analysis: null,
          isVariation: false,
        },
      },
      currentNodeId: a,
    };
    const ancestors = getAncestors(cyclic, a);
    expect(ancestors.length).toBeLessThanOrEqual(2);
  });

  it("navigates with jump / takeback / retry without losing branches", () => {
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    game = playMove(game, "e7e5").session;
    const leaf = game.tree.currentNodeId;
    const nodeCount = Object.keys(game.tree.nodes).length;

    const back = takeback(game);
    expect(back.ok).toBe(true);
    game = back.session;
    expect(game.tree.nodes[leaf]).toBeDefined();
    expect(Object.keys(game.tree.nodes)).toHaveLength(nodeCount);

    const retried = retryMove(game);
    expect(retried.ok).toBe(true);
    game = retried.session;
    expect(game.session.mode).toBe("playerTurn");
    expect(Object.keys(game.tree.nodes)).toHaveLength(nodeCount);
  });

  it("detects checkmate through the tree path", () => {
    let game = createGameSession();
    for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) {
      const result = playMove(game, uci);
      expect(result.ok).toBe(true);
      game = result.session;
    }
    const status = getStatusAtNode(game.tree, game.tree.currentNodeId);
    expect(status.isCheckmate).toBe(true);
    expect(game.session.mode).toBe("gameOver");
  });
});
