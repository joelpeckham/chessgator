import { describe, expect, it } from "vitest";
import {
  createGameSession,
  jumpToGameNode,
  playMove,
} from "@/domain/game";
import { createLocalStorageGameRepository } from "@/storage/local-storage";
import { migratePersistedGame } from "@/storage/migrate";
import {
  parsePersistedGame,
  toGameSession,
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

describe("persistence schema", () => {
  it("round-trips a branched game without Chess instances", () => {
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    game = playMove(game, "e7e5").session;
    game = jumpToGameNode(game, game.tree.rootId).session;
    game = playMove(game, "d2d4").session;

    const persisted = toPersistedGame(game, {
      preferences: { maiaElo: 1200, playerColor: "w" },
    });
    const json = JSON.parse(JSON.stringify(persisted)) as unknown;
    expect(JSON.stringify(json)).not.toMatch(/pending|worker|Chess/i);

    const parsed = parsePersistedGame(json);
    expect(parsed).not.toBeNull();
    const restored = toGameSession(parsed!);
    expect(restored.tree.currentNodeId).toBe(game.tree.currentNodeId);
    expect(Object.keys(restored.tree.nodes)).toEqual(
      Object.keys(game.tree.nodes),
    );
    expect(
      Object.values(restored.tree.nodes).every(
        (node) => typeof node.isVariation === "boolean",
      ),
    ).toBe(true);
  });

  it("treats missing isVariation as false for older snapshots", () => {
    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    const persisted = toPersistedGame(game);
    const legacy = JSON.parse(JSON.stringify(persisted)) as {
      tree: { nodes: Record<string, { isVariation?: boolean }> };
    };
    for (const node of Object.values(legacy.tree.nodes)) {
      delete node.isVariation;
    }
    const parsed = parsePersistedGame(legacy);
    expect(parsed).not.toBeNull();
    expect(
      Object.values(toGameSession(parsed!).tree.nodes).every(
        (n) => n.isVariation === false,
      ),
    ).toBe(true);
  });

  it("rejects corrupt and incomplete payloads", () => {
    expect(parsePersistedGame(null)).toBeNull();
    expect(parsePersistedGame({ version: 1 })).toBeNull();
    expect(parsePersistedGame({ version: 99, updatedAt: "x" })).toBeNull();
    expect(
      parsePersistedGame({
        version: 1,
        updatedAt: "2020-01-01T00:00:00.000Z",
        tree: { rootId: "a", currentNodeId: "missing", nodes: {} },
        session: {
          mode: "playerTurn",
          errorMessage: null,
          terminalReason: null,
        },
      }),
    ).toBeNull();
  });

  it("rejects parent cycles, invalid FENs, and illegal parent-to-child moves", () => {
    const startFen =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const afterE4 =
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

    const cyclic = {
      version: 1 as const,
      updatedAt: "2020-01-01T00:00:00.000Z",
      tree: {
        rootId: "root",
        currentNodeId: "a",
        nodes: {
          root: {
            id: "root",
            parentId: null,
            childIds: [],
            fen: startFen,
            move: null,
            ply: 0,
            analysis: null,
          },
          a: {
            id: "a",
            parentId: "b",
            childIds: ["b"],
            fen: afterE4,
            move: {
              from: "e2",
              to: "e4",
              san: "e4",
              uci: "e2e4",
              color: "w",
              piece: "p",
            },
            ply: 1,
            analysis: null,
          },
          b: {
            id: "b",
            parentId: "a",
            childIds: [],
            fen: afterE4,
            move: {
              from: "e7",
              to: "e5",
              san: "e5",
              uci: "e7e5",
              color: "b",
              piece: "p",
            },
            ply: 2,
            analysis: null,
          },
        },
      },
      session: {
        mode: "playerTurn" as const,
        errorMessage: null,
        terminalReason: null,
      },
    };
    expect(parsePersistedGame(cyclic)).toBeNull();

    const badFen = {
      version: 1 as const,
      updatedAt: "2020-01-01T00:00:00.000Z",
      tree: {
        rootId: "root",
        currentNodeId: "root",
        nodes: {
          root: {
            id: "root",
            parentId: null,
            childIds: [],
            fen: "not-a-fen",
            move: null,
            ply: 0,
            analysis: null,
          },
        },
      },
      session: {
        mode: "playerTurn" as const,
        errorMessage: null,
        terminalReason: null,
      },
    };
    expect(parsePersistedGame(badFen)).toBeNull();

    const illegalChild = {
      version: 1 as const,
      updatedAt: "2020-01-01T00:00:00.000Z",
      tree: {
        rootId: "root",
        currentNodeId: "child",
        nodes: {
          root: {
            id: "root",
            parentId: null,
            childIds: ["child"],
            fen: startFen,
            move: null,
            ply: 0,
            analysis: null,
          },
          child: {
            id: "child",
            parentId: "root",
            childIds: [],
            fen: afterE4,
            move: {
              from: "e7",
              to: "e5",
              san: "e5",
              uci: "e7e5",
              color: "b",
              piece: "p",
            },
            ply: 1,
            analysis: null,
          },
        },
      },
      session: {
        mode: "playerTurn" as const,
        errorMessage: null,
        terminalReason: null,
      },
    };
    expect(parsePersistedGame(illegalChild)).toBeNull();
  });

  it("migratePersistedGame fails closed on invalid data", () => {
    expect(migratePersistedGame(undefined).ok).toBe(false);
    expect(migratePersistedGame("nope").ok).toBe(false);
    expect(migratePersistedGame({ version: 2 }).ok).toBe(false);
  });

  it("localStorage repository recovers from missing/corrupt data", async () => {
    const storage = memoryStorage({ "chess-tutor:game:v1": "{not-json" });
    const repo = createLocalStorageGameRepository({ storage });
    expect(await repo.load()).toBeNull();

    let game = createGameSession();
    game = playMove(game, "e2e4").session;
    await repo.save(toPersistedGame(game));
    const loaded = await repo.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.tree.currentNodeId).toBe(game.tree.currentNodeId);

    storage.setItem("chess-tutor:game:v1", JSON.stringify({ version: 1 }));
    expect(await repo.load()).toBeNull();

    await repo.clear();
    expect(await repo.load()).toBeNull();
  });
});
