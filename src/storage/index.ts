export {
  GAME_SCHEMA_VERSION,
  parsePersistedGame,
  toGameSession,
  toPersistedGame,
  type PersistedGame,
  type PersistedGameV1,
  type PersistedMoveV1,
  type PersistedNodeV1,
} from "@/storage/schema";

export {
  migratePersistedGame,
  type MigrationResult,
} from "@/storage/migrate";

export {
  GAME_STORAGE_KEY,
  type GameRepository,
} from "@/storage/repository";

export { createLocalStorageGameRepository } from "@/storage/local-storage";
