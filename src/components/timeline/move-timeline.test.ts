import { describe, expect, it } from "vitest";
import { buildTimelineEntries } from "@/components/timeline/move-timeline";
import {
  createGameSession,
  jumpToGameNode,
  playMove,
} from "@/domain/game";

describe("move timeline entries", () => {
  it("keeps prior branches visible as alternates when a new mainline is preferred", () => {
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    const e4Node = game.tree.currentNodeId;

    game = jumpToGameNode(game, game.tree.rootId).session;
    game = playMove(game, "d2d4").session;
    const d4Node = game.tree.currentNodeId;

    const entries = buildTimelineEntries(game.tree);
    const start = entries.find((e) => e.node.id === game.tree.rootId);
    expect(start?.branchAlternates.some((n) => n.id === e4Node)).toBe(true);
    expect(entries.some((e) => e.node.id === d4Node && e.isOnPath)).toBe(true);
    expect(entries.some((e) => e.node.id === e4Node && e.isOnPath)).toBe(false);
  });
});
