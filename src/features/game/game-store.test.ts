import { beforeEach, describe, expect, it } from "vitest";
import {
  createInitialTree,
  createSessionState,
  playMoveOnTree,
} from "@/domain/game";
import {
  normalizeSessionForResume,
  useGameStore,
} from "@/features/game/game-store";
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

  it("exposes tree ops without requiring raw tree mutation", () => {
    const store = useGameStore.getState();
    store.startGame();
    expect(store.playMove("e2e4")).toBe(true);
    expect(useGameStore.getState().session.mode).toBe("opponentThinking");
    expect(useGameStore.getState().playMove("e7e5")).toBe(true);

    const leaf = useGameStore.getState().tree.currentNodeId;
    expect(
      useGameStore.getState().jumpToNode(useGameStore.getState().tree.rootId),
    ).toBe(true);
    expect(useGameStore.getState().session.mode).toBe("reviewing");
    expect(useGameStore.getState().retryMove()).toBe(false); // at root

    useGameStore.getState().jumpToNode(leaf);
    expect(useGameStore.getState().takeback()).toBe(true);
    expect(
      useGameStore
        .getState()
        .history()
        .map((m) => m.uci),
    ).toEqual(["e2e4"]);
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
    expect(state.session.errorMessage).toBeNull();
    expect(state.lastError).toBe("Engines failed to start");
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
      useGameStore
        .getState()
        .history()
        .map((m) => m.uci),
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

  it("normalizes transient modes on resume", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const normalized = normalizeSessionForResume({
      tree,
      session: createSessionState("analyzing"),
    });
    expect(normalized.session.mode).toBe("reviewing");
  });
});
