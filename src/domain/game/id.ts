let sequence = 0;

/** Root ID used only by the module-initial bootstrap tree. */
export const BOOTSTRAP_ROOT_ID = "root";

/** Stable node IDs for the game tree. Prefer UUID; fall back to a monotonic counter. */
export function createNodeId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  sequence += 1;
  return `node_${sequence.toString(36)}_${Date.now().toString(36)}`;
}

/** Test-only helper to keep IDs deterministic across runs when needed. */
export function resetNodeIdSequenceForTests(): void {
  sequence = 0;
}
