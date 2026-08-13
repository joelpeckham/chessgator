import { describe, expect, it } from "vitest";
import {
  resolveReviewFen,
  virtualId,
} from "@/components/timeline/branch-graph-virtual";
import { projectUciLine } from "@/domain/analysis";
import { createInitialTree, getNode } from "@/domain/game";

describe("resolveReviewFen", () => {
  it("resolves projected engine ids from the engine line", () => {
    const tree = createInitialTree();
    const root = getNode(tree, tree.rootId);
    expect(root).toBeDefined();
    if (!root) return;
    const engineLine = projectUciLine({
      rootFen: root.fen,
      rootNodeId: tree.rootId,
      lineUci: ["e2e4"],
      kind: "future",
      maxPlies: 1,
    });
    const ply = engineLine.plies[0];
    expect(ply).toBeDefined();
    if (!ply) return;
    const id = virtualId("projected", tree.rootId, ply.pathKey);
    const fen = resolveReviewFen(tree, id, null, engineLine);
    expect(fen).toBe(ply.fen);
    expect(fen).not.toBe(root.fen);
  });
});
