import type { ReactNode } from "react";

export type ShellFrameProps = {
  testId: string;
  hydrated?: boolean;
  resumed?: boolean;
  boardSize?: number;
  busy?: boolean;
  liveRegion?: ReactNode;
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
};

/** Shared header / main / footer chrome for the live shell and the mount placeholder. */
export function ShellFrame({
  testId,
  hydrated,
  resumed,
  boardSize,
  busy,
  liveRegion,
  header,
  children,
  footer,
}: ShellFrameProps) {
  return (
    <div
      className="game-shell relative flex h-dvh max-h-dvh flex-1 flex-col overflow-hidden bg-background"
      data-testid={testId}
      data-hydrated={hydrated == null ? undefined : hydrated ? "true" : "false"}
      data-resumed={resumed == null ? undefined : resumed ? "true" : "false"}
      data-board-size={boardSize}
      aria-busy={busy ? true : undefined}
    >
      {liveRegion}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
        {header}
      </header>
      <main className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
      <footer
        className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80"
        data-testid={testId === "game-shell" ? "timeline-bar" : undefined}
      >
        {footer}
      </footer>
    </div>
  );
}
