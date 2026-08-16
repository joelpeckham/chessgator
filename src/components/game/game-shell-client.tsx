"use client";

import { useSyncExternalStore } from "react";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { ShellFrame } from "@/components/game/shell-frame";
import { resolveGameRuntimeOptions } from "@/features/game/e2e-runtime";
import { GameShell } from "@/features/game/game-shell";

const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function GameShellPlaceholder() {
  return (
    <ShellFrame
      testId="game-shell-placeholder"
      busy
      header={
        <>
          <ChessgatorWordmark href="/" />
          <div className="size-8 animate-pulse rounded-full bg-muted/40" />
        </>
      }
      footer={<div className="h-[15.5rem] w-full animate-pulse bg-muted/30" />}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-2">
        <div className="aspect-square w-[min(calc(100vw-1.5rem),calc(100dvh-15rem),44rem)] max-w-full animate-pulse rounded-lg bg-muted/40" />
      </div>
    </ShellFrame>
  );
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
