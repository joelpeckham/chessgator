import {
  GAME_SCHEMA_VERSION,
  parsePersistedGame,
  type PersistedGame,
} from "@/storage/schema";

export type MigrationResult =
  | { ok: true; game: PersistedGame; migrated: boolean }
  | { ok: false; reason: string };

/**
 * Upgrade unknown stored JSON into the current schema.
 * Unknown / corrupt data fails closed (ok: false) so callers can start fresh.
 */
export function migratePersistedGame(raw: unknown): MigrationResult {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "missing" };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "corrupt" };
  }

  const record = raw as Record<string, unknown>;
  const version = record.version;

  if (typeof version !== "number") {
    return { ok: false, reason: "missing-version" };
  }

  if (version > GAME_SCHEMA_VERSION) {
    return { ok: false, reason: "future-version" };
  }

  // v1 is the first persisted shape; future versions chain here.
  if (version === 1) {
    const parsed = parsePersistedGame(record);
    if (!parsed) {
      return { ok: false, reason: "corrupt" };
    }
    return { ok: true, game: parsed, migrated: false };
  }

  return { ok: false, reason: `unsupported-version:${version}` };
}
