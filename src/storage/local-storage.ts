import { migratePersistedGame } from "@/storage/migrate";
import {
  GAME_STORAGE_KEY,
  type GameRepository,
} from "@/storage/repository";
import {
  GAME_SCHEMA_VERSION,
  parsePersistedGame,
  type PersistedGame,
} from "@/storage/schema";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getDefaultStorage(): StorageLike | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }
  return globalThis.localStorage;
}

/**
 * localStorage-backed GameRepository. Corrupt or migratable-fail data is
 * treated as missing (returns null) so the app can start a fresh session.
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
    async load(): Promise<PersistedGame | null> {
      if (!storage) return null;
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

      const migrated = migratePersistedGame(parsedJson);
      if (!migrated.ok) {
        return null;
      }

      // Re-parse after migration for a final integrity check.
      return parsePersistedGame(migrated.game);
    },

    async save(game: PersistedGame): Promise<void> {
      if (!storage) return;
      if (game.version !== GAME_SCHEMA_VERSION) {
        throw new Error(
          `Refusing to save unsupported schema version ${game.version}`,
        );
      }
      const validated = parsePersistedGame(game);
      if (!validated) {
        throw new Error("Refusing to save invalid game snapshot");
      }
      // Explicitly omit anything that is not part of PersistedGame.
      const snapshot: PersistedGame = {
        version: validated.version,
        updatedAt: validated.updatedAt,
        tree: validated.tree,
        session: validated.session,
        ...(validated.preferences
          ? { preferences: validated.preferences }
          : {}),
      };
      storage.setItem(key, JSON.stringify(snapshot));
    },

    async clear(): Promise<void> {
      if (!storage) return;
      try {
        storage.removeItem(key);
      } catch {
        // ignore quota / privacy mode failures on clear
      }
    },
  };
}
