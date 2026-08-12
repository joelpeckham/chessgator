import { describe, expect, it } from "vitest";
import {
  createGameSession,
  jumpToGameNode,
  playMove,
  setSessionMode,
} from "@/domain/game";

describe("game commands", () => {
  it("timeline jump during analyzing enters reviewing", () => {
    let game = createGameSession({ mode: "playerTurn" });
    game = playMove(game, "e2e4", { afterMode: "analyzing" }).session;
    expect(game.session.mode).toBe("analyzing");

    const jumped = jumpToGameNode(game, game.tree.rootId);
    expect(jumped.ok).toBe(true);
    expect(jumped.session.session.mode).toBe("reviewing");
    expect(jumped.session.tree.currentNodeId).toBe(game.tree.rootId);
  });

  it("setSessionMode still supports reviewing after analyzing", () => {
    const game = createGameSession({ mode: "analyzing" });
    const next = setSessionMode(game, "reviewing");
    expect(next.ok).toBe(true);
    expect(next.session.session.mode).toBe("reviewing");
  });
});
