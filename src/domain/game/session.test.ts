import { describe, expect, it } from "vitest";
import {
  createInitialTree,
  createSessionState,
  normalizeSessionForResume,
  playMoveOnTree,
  sessionModeForTurn,
} from "@/domain/game";
import { HUMAN_COLOR, OPPONENT_COLOR } from "@/domain/game/types";

describe("session policy", () => {
  it("maps the human side to playerTurn and the opponent to opponentThinking", () => {
    expect(sessionModeForTurn(HUMAN_COLOR)).toBe("playerTurn");
    expect(sessionModeForTurn(OPPONENT_COLOR)).toBe("opponentThinking");
  });

  it("normalizes transient modes on resume", () => {
    let tree = createInitialTree();
    const played = playMoveOnTree(tree, tree.rootId, "e2e4");
    expect(played).not.toBeNull();
    tree = played!.tree;
    const normalized = normalizeSessionForResume({
      tree,
      session: createSessionState("analyzing"),
    });
    expect(normalized.session.mode).toBe("reviewing");
  });

  it("resumes finished games as gameOver", () => {
    const tree = createInitialTree();
    const normalized = normalizeSessionForResume({
      tree,
      session: {
        mode: "gameOver",
        terminalReason: "resignation",
      },
    });
    expect(normalized.session.mode).toBe("gameOver");
    expect(normalized.session.terminalReason).toBe("resignation");
  });
});
