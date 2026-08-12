"use client";

import { useSyncExternalStore } from "react";
import { GameShell } from "@/features/game/game-shell";

const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function GameShellPlaceholder() {
  return (
    <div
      className="game-shell relative flex min-h-full flex-1 flex-col"
      data-testid="game-shell-placeholder"
      aria-busy="true"
    >
      <header className="relative z-10 border-b border-border/60 px-4 py-4 sm:px-6">
        <div className="mx-auto h-16 w-full max-w-6xl animate-pulse rounded-lg bg-muted/40" />
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:items-start sm:px-6">
        <div className="aspect-square w-full animate-pulse rounded-3xl bg-muted/40 md:flex-1" />
        <div className="h-96 w-full animate-pulse rounded-3xl bg-muted/40 md:w-88 lg:w-96" />
      </main>
    </div>
  );
}

export function GameShellClient() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    clientSnapshot,
    serverSnapshot,
  );

  return mounted ? <GameShell /> : <GameShellPlaceholder />;
}
