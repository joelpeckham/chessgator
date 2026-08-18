import { describe, expect, it } from "vitest";
import { createInitialTree, DEFAULT_POSITION, getTurn } from "@/domain/game";
import { playMoveOnTree } from "@/domain/game/tree";
import { heroBoardView } from "@/features/landing/hero-view";

function fenAfterE4(): string {
  const tree = createInitialTree();
  const played = playMoveOnTree(tree, tree.rootId, "e2e4");
  if (!played) throw new Error("Illegal move");
  return played.node.fen;
}

describe("heroBoardView", () => {
  it("shows an interactive starting position before the first hero move", () => {
    // Leftover /game state (fen, mode) must not leak into the landing demo.
    const view = heroBoardView({
      started: false,
      liveMode: "reviewing",
      liveFen: fenAfterE4(),
      humanColor: "w",
      maiaFailed: false,
    });
    expect(view.fen).toBe(DEFAULT_POSITION);
    expect(view.interactive).toBe(true);
    expect(view.gameOver).toBe(false);
  });

  it("locks the unstarted board only when Maia failed", () => {
    const view = heroBoardView({
      started: false,
      liveMode: "loading",
      liveFen: DEFAULT_POSITION,
      humanColor: "w",
      maiaFailed: true,
    });
    expect(view.interactive).toBe(false);
  });

  it("is interactive on the player's live turn once started", () => {
    const view = heroBoardView({
      started: true,
      liveMode: "playerTurn",
      liveFen: DEFAULT_POSITION,
      humanColor: "w",
      maiaFailed: false,
    });
    expect(view.fen).toBe(DEFAULT_POSITION);
    expect(view.interactive).toBe(true);
    expect(getTurn(view.fen)).toBe("w");
  });

  it("locks the board in non-playable live modes once started", () => {
    for (const liveMode of ["analyzing", "opponentThinking"] as const) {
      const view = heroBoardView({
        started: true,
        liveMode,
        liveFen: fenAfterE4(),
        humanColor: "w",
        maiaFailed: false,
      });
      expect(view.interactive).toBe(false);
      expect(view.gameOver).toBe(false);
    }
  });

  it("reports game over from the live session once started", () => {
    const view = heroBoardView({
      started: true,
      liveMode: "gameOver",
      liveFen: fenAfterE4(),
      humanColor: "w",
      maiaFailed: false,
    });
    expect(view.interactive).toBe(false);
    expect(view.gameOver).toBe(true);
  });
});
