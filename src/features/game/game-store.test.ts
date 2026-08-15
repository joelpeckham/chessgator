import { beforeEach, describe, expect, it } from "vitest";
import { getMoveHistory } from "@/domain/game";
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

describe("game store adapter", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...useGameStore.getInitialState(),
    });
  });

  it("plays moves without mutating the tree from outside the store", () => {
    const store = useGameStore.getState();
    store.startGame();
    expect(store.playMove("e2e4")).toBe(true);
    expect(useGameStore.getState().session.mode).toBe("opponentThinking");
    expect(useGameStore.getState().playMove("e7e5")).toBe(true);
    expect(
      getMoveHistory(
        useGameStore.getState().tree,
        useGameStore.getState().tree.currentNodeId,
      ).map((m) => m.uci),
    ).toEqual(["e2e4", "e7e5"]);
  });

  it("rejects illegal moves and keeps lastError", () => {
    useGameStore.getState().startGame();
    expect(useGameStore.getState().playMove("e2e5")).toBe(false);
    expect(useGameStore.getState().lastError).toBe("Illegal move");
  });

  it("setMode error preserves message in lastError only", () => {
    useGameStore.getState().startGame();
    expect(
      useGameStore.getState().setMode("error", "Engines failed to start"),
    ).toBe(true);
    const state = useGameStore.getState();
    expect(state.session.mode).toBe("error");
    expect(state.lastError).toBe("Engines failed to start");
  });

  it("starts Black games on the opponent's turn", () => {
    useGameStore.getState().startGame({ humanColor: "b" });
    expect(useGameStore.getState().humanColor).toBe("b");
    expect(useGameStore.getState().session.mode).toBe("opponentThinking");
  });

  it("resumePlay after error restores the side to move", () => {
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    useGameStore.getState().setMode("error", "Maia failed to move");
    useGameStore.getState().resumePlay();
    expect(useGameStore.getState().session.mode).toBe("opponentThinking");
    expect(useGameStore.getState().lastError).toBeNull();

    useGameStore.getState().playMove("e7e5");
    useGameStore.getState().setMode("error", "Maia failed to start");
    useGameStore.getState().resumePlay();
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
  });

  it("clamps Maia Elo preferences to the supported ladder", () => {
    useGameStore.getState().setMaiaElo(1540);
    expect(useGameStore.getState().preferences.maiaElo).toBe(1500);
    useGameStore.getState().setMaiaElo(900);
    expect(useGameStore.getState().preferences.maiaElo).toBe(1100);
    useGameStore.getState().setMaiaElo(2000);
    expect(useGameStore.getState().preferences.maiaElo).toBe(1900);
  });

  it("persists and hydrates through the repository", async () => {
    const storage = memoryStorage();
    const repo = createLocalStorageGameRepository({ storage });

    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    await useGameStore.getState().persist(repo);

    useGameStore.setState({ ...useGameStore.getInitialState() });
    const hydrated = await useGameStore.getState().hydrate(repo);
    expect(hydrated).toBe(true);
    expect(useGameStore.getState().resumed).toBe(true);
    expect(useGameStore.getState().session.mode).toBe("reviewing");
    expect(
      getMoveHistory(
        useGameStore.getState().tree,
        useGameStore.getState().tree.currentNodeId,
      ).map((m) => m.uci),
    ).toEqual(["e2e4"]);
  });

  it("hydrates resigned games as gameOver", async () => {
    const storage = memoryStorage();
    const repo = createLocalStorageGameRepository({ storage });

    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    useGameStore.getState().resign();
    await useGameStore.getState().persist(repo);

    useGameStore.setState({ ...useGameStore.getInitialState() });
    expect(await useGameStore.getState().hydrate(repo)).toBe(true);
    expect(useGameStore.getState().session.mode).toBe("gameOver");
    expect(useGameStore.getState().session.terminalReason).toBe("resignation");
  });

  it("persists and hydrates Black as the human side", async () => {
    const storage = memoryStorage();
    const repo = createLocalStorageGameRepository({ storage });

    useGameStore.getState().startGame({ humanColor: "b" });
    useGameStore.getState().playMove("e2e4");
    await useGameStore.getState().persist(repo);

    useGameStore.setState({ ...useGameStore.getInitialState() });
    expect(await useGameStore.getState().hydrate(repo)).toBe(true);
    expect(useGameStore.getState().humanColor).toBe("b");
    expect(useGameStore.getState().session.mode).toBe("reviewing");
    useGameStore.getState().resumePlay();
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
  });

  it("persists lessons keyed by reconstructed node ids", async () => {
    const storage = memoryStorage();
    const repo = createLocalStorageGameRepository({ storage });

    useGameStore.getState().startGame();
    useGameStore.getState().playMove("d2d4");
    const oldId = useGameStore.getState().tree.currentNodeId;
    useGameStore.getState().setLesson(oldId, {
      concept: "missed_improvement",
      confidence: 0.8,
      explanation: "d4 is a mistake because e4 claims more of the center.",
      suggestedMoveUci: "e2e4",
      suggestedMoveSan: "e4",
      lineUci: ["e2e4"],
      refutationUci: [],
      classification: "mistake",
      quip: "There's better.",
      nudge: true,
    });
    await useGameStore.getState().persist(repo);

    useGameStore.setState({ ...useGameStore.getInitialState() });
    expect(await useGameStore.getState().hydrate(repo)).toBe(true);
    const restoredId = useGameStore.getState().tree.currentNodeId;
    expect(restoredId).not.toBe(oldId);
    expect(useGameStore.getState().lessons[restoredId]?.suggestedMoveSan).toBe(
      "e4",
    );
  });

  it("prunes descendants, drops lessons, and relocates the pointer", () => {
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    const e4 = useGameStore.getState().tree.currentNodeId;
    useGameStore.getState().setLesson(e4, {
      concept: "missed_improvement",
      confidence: 0.8,
      explanation: "e4 is fine.",
      suggestedMoveUci: "d2d4",
      suggestedMoveSan: "d4",
      lineUci: ["d2d4"],
      refutationUci: [],
      classification: "best",
      quip: "Solid.",
      nudge: false,
    });
    useGameStore.getState().playMove("e7e5");
    const e5 = useGameStore.getState().tree.currentNodeId;
    useGameStore.getState().setLesson(e5, {
      concept: "missed_improvement",
      confidence: 0.5,
      explanation: "e5 is fine.",
      suggestedMoveUci: "c7c5",
      suggestedMoveSan: "c5",
      lineUci: ["c7c5"],
      refutationUci: [],
      classification: "best",
      quip: "Okay.",
      nudge: false,
    });

    expect(useGameStore.getState().pruneAtNode(e4, "descendants")).toBe(true);
    const state = useGameStore.getState();
    expect(state.tree.currentNodeId).toBe(e4);
    expect(state.tree.nodes[e5]).toBeUndefined();
    expect(state.lessons[e4]).toBeDefined();
    expect(state.lessons[e5]).toBeUndefined();
    expect(state.session.mode).toBe("opponentThinking");
  });

  it("goToNode jumps the pointer and syncs the side to move", () => {
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    const e4 = useGameStore.getState().tree.currentNodeId;
    useGameStore.getState().playMove("e7e5");
    expect(useGameStore.getState().goToNode(e4)).toBe(true);
    expect(useGameStore.getState().tree.currentNodeId).toBe(e4);
    expect(useGameStore.getState().session.mode).toBe("opponentThinking");

    useGameStore.getState().goToNode(useGameStore.getState().tree.rootId);
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
  });

  it("surfaces persist failures in lastError", async () => {
    const repo = createLocalStorageGameRepository({
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("quota", "QuotaExceededError");
        },
        removeItem: () => {},
      },
    });
    useGameStore.getState().startGame();
    await useGameStore.getState().persist(repo);
    expect(useGameStore.getState().lastError).toMatch(/could not save/i);
  });
});
