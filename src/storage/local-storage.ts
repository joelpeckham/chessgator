import {
  GAME_SCHEMA_VERSION,
  GAME_STORAGE_KEY,
  LEGACY_GAME_STORAGE_KEY,
  parseSavedGame,
  type GameRepository,
  type SavedGameV2,
} from "@/storage/schema";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getDefaultStorage(): StorageLike | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }
  return globalThis.localStorage;
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
  const storage = options?.storage === undefined
    ? getDefaultStorage()
    : options.storage;
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
      if (game.version !== GAME_SCHEMA_VERSION) {
        throw new Error(
          `Refusing to save unsupported schema version ${game.version}`,
        );
      }
      const validated = parseSavedGame(game);
      if (!validated) {
        throw new Error("Refusing to save invalid game snapshot");
      }
      // Re-validate by ensuring reconstruct would succeed is left to callers;
      // structural parse is enough to refuse obvious corruption.
      storage.setItem(key, JSON.stringify(validated));
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
