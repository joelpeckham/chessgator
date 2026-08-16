import { describe, expect, it } from "vitest";
import {
  createInitialTree,
  type GameTree,
  jumpToNode,
  playMoveOnTree,
} from "@/domain/game";
import { createLocalStorageGameRepository } from "@/storage/local-storage";
import {
  GAME_STORAGE_KEY,
  parseSavedGame,
  reconstructGame,
  toPersistedGame,
} from "@/storage/schema";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
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

function play(tree: GameTree, uci: string): GameTree {
  return playMoveOnTree(tree, tree.currentNodeId, uci)!.tree;
}

describe("persistence schema v2", () => {
  it("round-trips a branched game without Chess instances", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    tree = play(tree, "e7e5");
    tree = jumpToNode(tree, tree.rootId)!;
    tree = play(tree, "d2d4");

    const persisted = toPersistedGame(tree, { maiaElo: 1200 });
    const json = JSON.parse(JSON.stringify(persisted)) as unknown;
    expect(JSON.stringify(json)).not.toMatch(/pending|worker|Chess/i);
    expect(persisted.version).toBe(2);
    expect(persisted.tree.children).toHaveLength(2);
    // d4 is preferred mainline (index 0); e4 is sibling at index 1.
    expect(persisted.tree.children![0]!.uci).toBe("d2d4");
    expect(persisted.currentPath).toEqual([0]);

    const parsed = parseSavedGame(json);
    expect(parsed).not.toBeNull();
    const restored = reconstructGame(parsed!);
    expect(restored).not.toBeNull();
    expect(restored!.maiaElo).toBe(1200);
    expect(
      Object.values(restored!.tree.nodes).every((n) => !n.isVariation),
    ).toBe(true);
    expect(restored!.tree.nodes[restored!.tree.currentNodeId]?.move?.uci).toBe(
      "d2d4",
    );
    const root = restored!.tree.nodes[restored!.tree.rootId]!;
    expect(root.childIds).toHaveLength(2);
  });

  it("excludes variation ghosts from the persisted tree", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    const ghost = playMoveOnTree(tree, tree.rootId, "d2d4", {
      asVariation: true,
    });
    expect(ghost).not.toBeNull();
    tree = ghost!.tree;

    const persisted = toPersistedGame(tree, { maiaElo: 1500 });
    expect(persisted.tree.children).toHaveLength(1);
    expect(persisted.tree.children![0]!.uci).toBe("e2e4");
    // Current pointer was on a ghost — path falls back to committed ancestor (root).
    expect(persisted.currentPath).toEqual([]);
  });

  it("rejects corrupt JSON and wrong versions", () => {
    expect(parseSavedGame(null)).toBeNull();
    expect(parseSavedGame({ version: 1 })).toBeNull();
    expect(parseSavedGame({ version: 99 })).toBeNull();
    expect(
      parseSavedGame({
        version: 2,
        rootFen: "not-a-fen",
        currentPath: [],
        tree: {},
        maiaElo: 1500,
      }),
    ).toBeNull();
  });

  it("fails closed on illegal child UCI during reconstruct", () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const parsed = parseSavedGame({
      version: 2,
      rootFen: startFen,
      currentPath: [0],
      tree: {
        children: [{ uci: "e7e5" }],
      },
      maiaElo: 1500,
    });
    expect(parsed).not.toBeNull();
    expect(reconstructGame(parsed!)).toBeNull();
  });

  it("fails closed on invalid currentPath indexes", () => {
    const tree = play(createInitialTree(), "e2e4");
    const persisted = toPersistedGame(tree, { maiaElo: 1500 });
    const badPath = { ...persisted, currentPath: [9] };
    expect(reconstructGame(badPath)).toBeNull();
  });

  it("persists elo and resignation flag", () => {
    const tree = play(createInitialTree(), "e2e4");
    const persisted = toPersistedGame(tree, {
      maiaElo: 1600,
      resigned: true,
    });
    expect(persisted.maiaElo).toBe(1600);
    expect(persisted.resigned).toBe(true);
    const restored = reconstructGame(persisted)!;
    expect(restored.maiaElo).toBe(1600);
    expect(restored.resigned).toBe(true);
  });

  it("persists human color and defaults missing snapshots to White", () => {
    const tree = play(createInitialTree(), "e2e4");
    const asBlack = toPersistedGame(tree, {
      maiaElo: 1500,
      humanColor: "b",
    });
    expect(asBlack.humanColor).toBe("b");
    expect(reconstructGame(asBlack)!.humanColor).toBe("b");

    const asWhite = toPersistedGame(tree, { maiaElo: 1500 });
    expect(asWhite.humanColor).toBe("w");
    const withoutColor = {
      version: asWhite.version,
      rootFen: asWhite.rootFen,
      currentPath: asWhite.currentPath,
      tree: asWhite.tree,
      maiaElo: asWhite.maiaElo,
    };
    expect(parseSavedGame(withoutColor)?.humanColor).toBeUndefined();
    expect(reconstructGame(parseSavedGame(withoutColor)!)!.humanColor).toBe(
      "w",
    );

    expect(
      parseSavedGame({
        ...asWhite,
        humanColor: "green",
      }),
    ).toBeNull();
  });

  it("localStorage repository recovers from missing/corrupt data", async () => {
    const storage = memoryStorage({ [GAME_STORAGE_KEY]: "{not-json" });
    const repo = createLocalStorageGameRepository({ storage });
    expect(await repo.load()).toBeNull();

    const tree = play(createInitialTree(), "e2e4");
    await repo.save(toPersistedGame(tree, { maiaElo: 1500 }));
    const loaded = await repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.tree.children?.[0]?.uci).toBe("e2e4");

    storage.setItem(GAME_STORAGE_KEY, JSON.stringify({ version: 2 }));
    expect(await repo.load()).toBeNull();

    await repo.clear();
    expect(await repo.load()).toBeNull();
  });

  it("clears legacy v1 key on load", async () => {
    const storage = memoryStorage({
      "chessgator:game:v1": JSON.stringify({ version: 1 }),
    });
    const repo = createLocalStorageGameRepository({ storage });
    expect(await repo.load()).toBeNull();
    expect(storage.getItem("chessgator:game:v1")).toBeNull();
  });

  it("round-trips compact lessons onto reconstructed node ids", () => {
    let tree = createInitialTree();
    tree = play(tree, "d2d4");
    const d4Id = tree.currentNodeId;
    const persisted = toPersistedGame(tree, {
      maiaElo: 1500,
      lessons: {
        [d4Id]: {
          classification: "mistake",
          concept: "missed_improvement",
          confidence: 0.8,
          explanation: "d4 is a mistake because e4 claims more of the center.",
          suggestedMoveUci: "e2e4",
          suggestedMoveSan: "e4",
          lineUci: ["e2e4"],
          refutationUci: [],
          nudge: true,
        },
      },
    });
    expect(persisted.tree.children?.[0]?.lesson?.suggestedMoveSan).toBe("e4");

    const restored = reconstructGame(persisted)!;
    const newId = restored.tree.currentNodeId;
    expect(newId).not.toBe(d4Id);
    expect(restored.lessons[newId]?.suggestedMoveSan).toBe("e4");
  });

  it("drops invalid lessons without failing the snapshot", () => {
    const tree = play(createInitialTree(), "e2e4");
    const persisted = toPersistedGame(tree, { maiaElo: 1500 });
    persisted.tree.children![0]!.lesson = {
      classification: "not-a-class" as never,
      concept: "missed_improvement",
      confidence: 0.8,
      explanation: "nope",
      suggestedMoveUci: null,
      suggestedMoveSan: null,
      lineUci: [],
      refutationUci: [],
      nudge: false,
    };
    const parsed = parseSavedGame(JSON.parse(JSON.stringify(persisted)));
    expect(parsed).not.toBeNull();
    expect(parsed!.tree.children?.[0]?.lesson).toBeUndefined();
    const restored = reconstructGame(parsed!)!;
    expect(Object.keys(restored.lessons)).toEqual([]);
  });
});
