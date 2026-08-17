import { beforeEach, describe, expect, it } from "vitest";
import { getCurrentNode, getMoveHistory } from "@/domain/game";
import { applyGamePresets } from "@/features/game/apply-game-presets";
import { useGameStore } from "@/features/game/game-store";

describe("applyGamePresets", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...useGameStore.getInitialState(),
    });
  });

  it("starts a new game at the requested Elo", () => {
    const result = applyGamePresets(useGameStore.getState(), { elo: 1200 });
    expect(result.ok).toBe(true);
    expect(useGameStore.getState().preferences.maiaElo).toBe(1200);
    expect(useGameStore.getState().resumed).toBe(false);
  });

  it("replays a SAN line and seats the player on the side to move", () => {
    const result = applyGamePresets(useGameStore.getState(), {
      moves: ["e4", "e5", "Nf3"],
    });
    expect(result.ok).toBe(true);
    expect(
      getMoveHistory(
        useGameStore.getState().tree,
        useGameStore.getState().tree.currentNodeId,
      ).map((m) => m.san),
    ).toEqual(["e4", "e5", "Nf3"]);
    expect(useGameStore.getState().humanColor).toBe("b");
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
  });

  it("starts from a FEN and plays as Black", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const result = applyGamePresets(useGameStore.getState(), {
      fen,
      color: "black",
    });
    expect(result.ok).toBe(true);
    expect(useGameStore.getState().humanColor).toBe("b");
    expect(getCurrentNode(useGameStore.getState().tree).fen).toBe(fen);
    expect(useGameStore.getState().session.mode).toBe("opponentThinking");
  });

  it("rejects an invalid FEN without crashing", () => {
    const result = applyGamePresets(useGameStore.getState(), {
      fen: "not-a-fen",
    });
    expect(result.ok).toBe(false);
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
  });

  it("leaves an even-length opening on White to move as playerTurn", () => {
    applyGamePresets(useGameStore.getState(), { moves: ["e4", "c5"] });
    expect(useGameStore.getState().humanColor).toBe("w");
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
  });

  it("keeps an explicit color when a ply is also set", () => {
    const result = applyGamePresets(useGameStore.getState(), {
      moves: ["e4", "e5", "Nf3"],
      ply: 2,
      color: "white",
    });
    expect(result.ok).toBe(true);
    const state = useGameStore.getState();
    expect(getCurrentNode(state.tree).move?.san).toBe("e5");
    expect(state.humanColor).toBe("w");
    expect(state.session.mode).toBe("playerTurn");
  });

  it("replays a full game, sits on the key ply, and seats that side", () => {
    const result = applyGamePresets(useGameStore.getState(), {
      moves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
      ply: 6,
    });
    expect(result.ok).toBe(true);
    const state = useGameStore.getState();
    expect(getCurrentNode(state.tree).move?.san).toBe("Nf6");
    expect(state.humanColor).toBe("w");
    expect(state.session.mode).toBe("playerTurn");
    expect(
      getMoveHistory(state.tree, state.tree.currentNodeId).map((m) => m.san),
    ).toEqual(["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6"]);
    const root = state.tree.nodes[state.tree.rootId];
    expect(countDescendants(state.tree, root?.id ?? "")).toBe(7);
  });
});

function countDescendants(
  tree: ReturnType<typeof useGameStore.getState>["tree"],
  nodeId: string,
): number {
  const node = tree.nodes[nodeId];
  if (!node) return 0;
  return node.childIds.reduce(
    (sum, childId) => sum + 1 + countDescendants(tree, childId),
    0,
  );
}
