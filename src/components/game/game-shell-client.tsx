"use client";

import { useSyncExternalStore } from "react";
import { GameShell } from "@/features/game/game-shell";

const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function GameShellPlaceholder() {
  return (
    <div
      className="game-shell relative flex h-dvh max-h-dvh flex-1 flex-col overflow-hidden bg-background"
      data-testid="game-shell-placeholder"
      aria-busy="true"
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
        <div className="h-6 w-36 animate-pulse rounded-md bg-muted/40" />
        <div className="size-8 animate-pulse rounded-full bg-muted/40" />
      </header>
      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-2">
        <div className="aspect-square w-[min(calc(100vw-1.5rem),calc(100dvh-11rem),44rem)] max-w-full animate-pulse rounded-lg bg-muted/40" />
      </main>
      <footer className="sticky bottom-0 shrink-0 border-t border-border px-2 py-1.5 sm:px-3">
        <div className="h-14 w-full animate-pulse rounded-md bg-muted/40" />
      </footer>
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
