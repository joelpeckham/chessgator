"use client";

import { GameShellLayout } from "@/features/game/game-shell-layout";
import { useGameStore } from "@/features/game/game-store";
import { buildShellView } from "@/features/game/shell-view";
import { useBoardViewport } from "@/features/game/use-board-viewport";
import {
  type GameRuntimeOptions,
  useGameRuntime,
} from "@/features/game/use-game-runtime";
import { useShellUi } from "@/features/game/use-shell-ui";

/**
 * Client-only game composition. All workers, Zustand, and browser APIs stay here
 * (or below) so `page.tsx` can remain a static Server Component shell.
 */
export function GameShell(props: GameRuntimeOptions = {}) {
  const tree = useGameStore((s) => s.tree);
  const session = useGameStore((s) => s.session);
  const preferences = useGameStore((s) => s.preferences);
  const hydrated = useGameStore((s) => s.hydrated);
  const resumed = useGameStore((s) => s.resumed);
  const lastError = useGameStore((s) => s.lastError);
  const setMaiaElo = useGameStore((s) => s.setMaiaElo);

  const runtime = useGameRuntime(props);
  const { boardSize, compact, mascotBelow, boardLeft } = useBoardViewport();
  const ui = useShellUi(runtime);
  const view = buildShellView({
    tree,
    session,
    preferences,
    hydrated,
    resumed,
    lastError,
    boardSize,
    compact,
    mascotBelow,
    boardLeft,
    runtime,
    ui,
  });

  return <GameShellLayout view={view} ui={ui} onMaiaEloChange={setMaiaElo} />;
}
