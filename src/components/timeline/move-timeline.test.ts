import { describe, expect, it } from "vitest";
import { buildTimelineEntries } from "@/components/timeline/move-timeline";
import { createInitialTree, jumpToNode, playMoveOnTree } from "@/domain/game";

describe("move timeline entries", () => {
  it("keeps prior branches visible as alternates when a new mainline is preferred", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Node = tree.currentNodeId;

    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Node = tree.currentNodeId;

    const entries = buildTimelineEntries(tree);
    const start = entries.find((e) => e.node.id === tree.rootId);
    expect(start?.branchAlternates.some((n) => n.id === e4Node)).toBe(true);
    expect(entries.some((e) => e.node.id === d4Node && e.isOnPath)).toBe(true);
    expect(entries.some((e) => e.node.id === e4Node && e.isOnPath)).toBe(false);
  });
});
