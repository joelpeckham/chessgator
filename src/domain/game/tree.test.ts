import { describe, expect, it } from "vitest";
import {
  createBootstrapTree,
  createInitialTree,
  getAncestors,
  getMoveHistory,
  getStatusAtNode,
  jumpToNode,
  listMainlineChild,
  playMoveOnTree,
  takebackOne,
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
    expect(
      getMoveHistory(played!.tree, played!.node.id).map((m) => m.uci),
    ).toEqual(["e2e4"]);
  });

  it("reuses an existing branch when the same move is replayed", () => {
    let tree = createInitialTree();
    const first = playMoveOnTree(tree, tree.rootId, "e2e4");
    expect(first).not.toBeNull();
    tree = first!.tree;
    const childId = tree.currentNodeId;

    tree = jumpToNode(tree, tree.rootId)!;
    const again = playMoveOnTree(tree, tree.rootId, "e2e4");
    expect(again).not.toBeNull();
    expect(again!.tree.currentNodeId).toBe(childId);
    expect(Object.keys(again!.tree.nodes)).toHaveLength(
      Object.keys(tree.nodes).length,
    );
  });

  it("creates a sibling branch for an alternate move", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Node = tree.currentNodeId;

    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;

    const root = tree.nodes[tree.rootId]!;
    expect(root.childIds).toHaveLength(2);
    expect(root.childIds).toContain(e4Node);
    expect(root.childIds).toContain(tree.currentNodeId);
    expect(e4Node).not.toBe(tree.currentNodeId);
  });

  it("makes a newly committed alternate the preferred mainline child", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Node = tree.currentNodeId;

    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Node = tree.currentNodeId;

    const root = tree.nodes[tree.rootId]!;
    expect(root.childIds[0]).toBe(d4Node);
    expect(listMainlineChild(tree, root.id)?.id).toBe(d4Node);
    expect(root.childIds).toContain(e4Node);
    expect(tree.nodes[e4Node]?.move?.uci).toBe("e2e4");
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
          isVariation: false,
        },
        [b]: {
          id: b,
          parentId: a,
          childIds: [],
          fen: tree.nodes[rootId]!.fen,
          move: null,
          ply: 2,
          isVariation: false,
        },
      },
      currentNodeId: a,
    };
    const ancestors = getAncestors(cyclic, a);
    expect(ancestors.length).toBeLessThanOrEqual(2);
  });

  it("navigates with jump / takeback without losing branches", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.currentNodeId, "e2e4")!.tree;
    tree = playMoveOnTree(tree, tree.currentNodeId, "e7e5")!.tree;
    const leaf = tree.currentNodeId;
    const nodeCount = Object.keys(tree.nodes).length;

    const back = takebackOne(tree);
    expect(back).not.toBeNull();
    tree = back!;
    expect(tree.nodes[leaf]).toBeDefined();
    expect(Object.keys(tree.nodes)).toHaveLength(nodeCount);
    expect(jumpToNode(tree, leaf)?.currentNodeId).toBe(leaf);
  });

  it("detects checkmate through the tree path", () => {
    let tree = createInitialTree();
    for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) {
      const result = playMoveOnTree(tree, tree.currentNodeId, uci);
      expect(result).not.toBeNull();
      tree = result!.tree;
    }
    const status = getStatusAtNode(tree, tree.currentNodeId);
    expect(status.isCheckmate).toBe(true);
    expect(status.isGameOver).toBe(true);
  });
});
