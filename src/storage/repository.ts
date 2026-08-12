import type { PersistedGame } from "@/storage/schema";

/**
 * Versioned persistence contract for game snapshots.
 * Implementations must not serialize live Chess instances, workers, or jobs.
 */
export interface GameRepository {
  load(): Promise<PersistedGame | null>;
  save(game: PersistedGame): Promise<void>;
  clear(): Promise<void>;
}

export const GAME_STORAGE_KEY = "chess-tutor:game:v1";
