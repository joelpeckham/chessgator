import { type GameTree, listMainlineChild } from "@/domain/game";
import { useGameStore } from "@/features/game/game-store";

/** Follow the committed line from the current pointer to its leaf. */
export function playableLeafId(tree: GameTree): string {
  let id = tree.currentNodeId;
  const visited = new Set<string>();
  for (;;) {
    if (visited.has(id)) return id;
    visited.add(id);
    const child = listMainlineChild(tree, id);
    if (!child) return id;
    id = child.id;
  }
}

/**
 * Hand the hero game to /game, but only when the visitor actually played
 * here. An untouched store lets /game hydrate any saved game as usual.
 */
export function handOffHeroGame(hasPlayed: boolean): void {
  if (!hasPlayed) return;
  finalizeHeroHandoff();
}

/**
 * Seat a live turn, persist, and mark the preset flag so /game trusts this
 * tree instead of re-hydrating back into reviewing.
 */
function finalizeHeroHandoff(): void {
  const state = useGameStore.getState();
  if (state.session.mode !== "gameOver") {
    const leafId = playableLeafId(state.tree);
    if (leafId !== state.tree.currentNodeId) {
      state.goToNode(leafId);
    }
    state.resumePlay();
    // A pending book reply dies with this component; let Maia answer instead.
    if (useGameStore.getState().session.mode === "analyzing") {
      useGameStore.getState().setMode("opponentThinking");
    }
  }
  void useGameStore.getState().persist();
  useGameStore.getState().markUrlPresetApplied();
}
