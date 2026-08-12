"use client";

import { useSyncExternalStore } from "react";
import { createCoachingController } from "@/features/game/coaching-controller";
import { GameShell } from "@/features/game/game-shell";
import { createStubAnalysisEngine } from "@/features/game/stub-analysis";
import { createStubMaiaSession } from "@/features/game/stub-maia";
import type { GameRuntimeOptions } from "@/features/game/use-game-runtime";

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
        <div className="aspect-square w-[min(calc(100vw-1.5rem),calc(100dvh-17rem),44rem)] max-w-full animate-pulse rounded-lg bg-muted/40" />
      </main>
      <footer className="sticky bottom-0 shrink-0 border-t border-border">
        <div className="h-10 w-full border-b border-border bg-muted/20" />
        <div className="h-[15.5rem] w-full animate-pulse bg-muted/30" />
      </footer>
    </div>
  );
}

/** Playwright URL contract: `?e2eStub=1|coach|fallback`. */
function resolveGameRuntimeOptions(): GameRuntimeOptions {
  if (typeof window === "undefined") return {};
  const stub = new URLSearchParams(window.location.search).get("e2eStub");
  if (stub !== "1" && stub !== "coach" && stub !== "fallback") {
    return {};
  }
  return {
    createMaiaSession:
      stub === "fallback"
        ? undefined
        : () =>
            createStubMaiaSession({
              initDelayMs: 40,
              moveDelayMs: 20,
              scriptedMoves: stub === "coach" ? ["e7e5"] : undefined,
            }),
    createCoachingController: () =>
      createCoachingController({
        createEngine: () => createStubAnalysisEngine(),
      }),
  };
}

export function GameShellClient() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    clientSnapshot,
    serverSnapshot,
  );

  return mounted ? (
    <GameShell {...resolveGameRuntimeOptions()} />
  ) : (
    <GameShellPlaceholder />
  );
}
