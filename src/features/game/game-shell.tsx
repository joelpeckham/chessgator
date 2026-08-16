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
  const humanColor = useGameStore((s) => s.humanColor);
  const preferences = useGameStore((s) => s.preferences);
  const lessons = useGameStore((s) => s.lessons);
  const hydrated = useGameStore((s) => s.hydrated);
  const resumed = useGameStore((s) => s.resumed);
  const lastError = useGameStore((s) => s.lastError);
  const setMaiaElo = useGameStore((s) => s.setMaiaElo);

  const runtime = useGameRuntime(props);
  const ui = useShellUi(runtime);
  const { boardSize, mascotBelow, boardLeft, mascotLeft } = useBoardViewport(
    ui.timelineExpanded,
  );
  const view = buildShellView({
    tree,
    session,
    humanColor,
    preferences,
    lessons,
    hydrated,
    resumed,
    lastError,
    boardSize,
    mascotBelow,
    boardLeft,
    mascotLeft,
    stubMode: Boolean(props.stubMode),
    runtime,
    ui,
  });

  return <GameShellLayout view={view} ui={ui} onMaiaEloChange={setMaiaElo} />;
}
