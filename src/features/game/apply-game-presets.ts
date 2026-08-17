import type { Color } from "@/domain/game";
import { isValidFen } from "@/domain/game";
import type { GamePreset } from "@/lib/game-href";

export type GamePresetStore = {
  startGame: (options?: { fen?: string; humanColor?: Color }) => void;
  playMove: (input: string) => boolean;
  setMaiaElo: (elo: number) => void;
  readyToMove: () => void;
  goToNode: (nodeId: string) => boolean;
  getCurrentNodeId: () => string;
};

export type ApplyGamePresetsResult = {
  ok: boolean;
  message: string | null;
};

/**
 * Start a fresh game from a `/game?…` preset. URL presets always win over a
 * resumed local game so content-page CTAs open the position they advertise.
 */
export function applyGamePresets(
  store: GamePresetStore,
  preset: GamePreset,
): ApplyGamePresetsResult {
  if (preset.elo !== undefined) {
    store.setMaiaElo(preset.elo);
  }

  const humanColor: Color | undefined =
    preset.color === "black" ? "b" : preset.color === "white" ? "w" : undefined;

  const fen = preset.fen;
  if (fen && !isValidFen(fen)) {
    store.startGame({ humanColor });
    if (!preset.color) store.readyToMove();
    return { ok: false, message: "That starting position was not valid." };
  }

  store.startGame({
    ...(fen ? { fen } : {}),
    ...(humanColor ? { humanColor } : {}),
  });

  const rootId = store.getCurrentNodeId();
  let takeOverId: string | null = null;
  let played = 0;
  if (preset.moves && preset.moves.length > 0) {
    for (const move of preset.moves) {
      if (!store.playMove(move)) break;
      played += 1;
      if (preset.ply === played) {
        takeOverId = store.getCurrentNodeId();
      }
    }
  }

  if (preset.ply === 0) {
    store.goToNode(rootId);
  } else if (takeOverId) {
    store.goToNode(takeOverId);
  }

  // Openings and famous-game take-overs omit `color` so the visitor always
  // has the next move. An explicit color keeps Maia on the other side even
  // when a `ply` is also set — readyToMove would overwrite that seat.
  if (!preset.color) store.readyToMove();

  if (preset.moves && played < preset.moves.length) {
    return {
      ok: false,
      message: "Could not play the full requested line.",
    };
  }

  return { ok: true, message: presetMessage(preset) };
}

function presetMessage(preset: GamePreset): string | null {
  if (preset.fen || (preset.moves && preset.moves.length > 0)) {
    return "Started from the requested position.";
  }
  if (preset.elo !== undefined) {
    return `Playing Maia at ${preset.elo}.`;
  }
  return null;
}
