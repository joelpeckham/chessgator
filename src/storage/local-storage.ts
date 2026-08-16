import {
  GAME_STORAGE_KEY,
  type GameRepository,
  LEGACY_GAME_STORAGE_KEY,
  parseSavedGame,
  type SavedGameV2,
} from "@/storage/schema";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getDefaultStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    if (typeof storage === "undefined") return null;
    return storage;
  } catch {
    // Privacy mode / blocked site data throws SecurityError on access.
    return null;
  }
}

/**
 * localStorage-backed GameRepository. Corrupt data is treated as missing
 * (returns null) so the app can start a fresh session. Legacy v1 keys are
 * cleared and ignored — no migration.
 */
export function createLocalStorageGameRepository(options?: {
  storage?: StorageLike | null;
  key?: string;
}): GameRepository {
  const storage =
    options?.storage === undefined ? getDefaultStorage() : options.storage;
  const key = options?.key ?? GAME_STORAGE_KEY;

  return {
    async load(): Promise<SavedGameV2 | null> {
      if (!storage) return null;

      try {
        storage.removeItem(LEGACY_GAME_STORAGE_KEY);
      } catch {
        // ignore
      }

      let rawText: string | null;
      try {
        rawText = storage.getItem(key);
      } catch {
        return null;
      }
      if (rawText === null || rawText === "") return null;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText) as unknown;
      } catch {
        return null;
      }

      return parseSavedGame(parsedJson);
    },

    async save(game: SavedGameV2): Promise<void> {
      if (!storage) return;
      try {
        storage.setItem(key, JSON.stringify(game));
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not save the game: ${detail}`, { cause: err });
      }
    },

    async clear(): Promise<void> {
      if (!storage) return;
      try {
        storage.removeItem(key);
        storage.removeItem(LEGACY_GAME_STORAGE_KEY);
      } catch {
        // ignore quota / privacy mode failures on clear
      }
    },
  };
}
