import { beforeEach, describe, expect, it } from "vitest";
import { getCurrentNode, getMoveHistory } from "@/domain/game";
import { applyGamePresets } from "@/features/game/apply-game-presets";
import { useGameStore } from "@/features/game/game-store";
import { createLocalStorageGameRepository } from "@/storage";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

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

  it("steps back from a mating line so the visitor has a legal move", () => {
    const result = applyGamePresets(useGameStore.getState(), {
      moves: ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"],
    });
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Started from the last playable position.");
    const state = useGameStore.getState();
    expect(getCurrentNode(state.tree).move?.san).toBe("Nf6");
    expect(state.humanColor).toBe("w");
    expect(state.session.mode).toBe("playerTurn");
  });

  it("seats Myers Variation as Black on playerTurn", () => {
    const result = applyGamePresets(useGameStore.getState(), {
      moves: ["b4", "d5", "Bb2", "c6", "a4"],
    });
    expect(result.ok).toBe(true);
    const state = useGameStore.getState();
    expect(state.session.mode).toBe("playerTurn");
    expect(state.humanColor).toBe("b");
    expect(state.urlPresetApplied).toBe(true);
  });

  it("does not let a later hydrate overwrite a content CTA into reviewing", async () => {
    const storage = memoryStorage();
    const repo = createLocalStorageGameRepository({ storage });
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    await useGameStore.getState().persist(repo);

    applyGamePresets(useGameStore.getState(), {
      moves: ["b4", "d5", "Bb2", "c6", "a4"],
    });
    expect(useGameStore.getState().session.mode).toBe("playerTurn");

    const hydrated = await useGameStore.getState().hydrate(repo);
    expect(hydrated).toBe(false);
    const state = useGameStore.getState();
    expect(state.session.mode).toBe("playerTurn");
    expect(state.humanColor).toBe("b");
    expect(
      getMoveHistory(state.tree, state.tree.currentNodeId).map((m) => m.san),
    ).toEqual(["b4", "d5", "Bb2", "c6", "a4"]);
  });

  it("rejects a terminal FEN without a playable ancestor", () => {
    const result = applyGamePresets(useGameStore.getState(), {
      fen: "8/8/8/8/8/5k2/5p2/5K2 w - - 0 1",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("That position is already finished.");
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
    expect(getCurrentNode(useGameStore.getState().tree).fen).toMatch(
      /^rnbqkbnr\/pppppppp/,
    );
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
