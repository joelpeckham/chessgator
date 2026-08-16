import { describe, expect, it } from "vitest";
import {
  createInitialTree,
  createSessionState,
  normalizeSessionForResume,
  playMoveOnTree,
  sessionModeForPosition,
  sessionModeForTurn,
} from "@/domain/game";

describe("session policy", () => {
  it("maps the human side to playerTurn and the opponent to opponentThinking", () => {
    expect(sessionModeForTurn("w", "w")).toBe("playerTurn");
    expect(sessionModeForTurn("b", "w")).toBe("opponentThinking");
    expect(sessionModeForTurn("b", "b")).toBe("playerTurn");
    expect(sessionModeForTurn("w", "b")).toBe("opponentThinking");
  });

  it("treats interior opponent-to-move nodes as reviewing", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4 = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4, "e7e5")!.tree;
    tree = { ...tree, currentNodeId: e4 };
    expect(sessionModeForPosition(tree, e4, "w")).toBe("reviewing");
    expect(sessionModeForPosition(tree, tree.rootId, "w")).toBe("playerTurn");
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

  it("resumes an empty tree as loading", () => {
    const tree = createInitialTree();
    const normalized = normalizeSessionForResume({
      tree,
      session: createSessionState("playerTurn"),
    });
    expect(normalized.session.mode).toBe("loading");
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
