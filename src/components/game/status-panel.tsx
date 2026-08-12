"use client";

import type {
  GameStatus,
  GameStatusReason,
  SessionMode,
} from "@/domain/game";
import type { OpponentControllerState } from "@/features/game/opponent-controller";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusPanelProps = {
  mode: SessionMode;
  status: GameStatus;
  /** Session override (e.g. resignation) when rules status is still ongoing. */
  terminalReason?: GameStatusReason | null;
  opponent: OpponentControllerState;
  lastError: string | null;
  /** Persistent coaching/engine failure that still allows play. */
  coachUnavailable?: string | null;
};

export function StatusPanel({
  mode,
  status,
  terminalReason = null,
  opponent,
  lastError,
  coachUnavailable = null,
}: StatusPanelProps) {
  const effectiveReason = terminalReason ?? status.reason;
  const headline = headlineFor({
    mode,
    status,
    terminalReason: effectiveReason,
    opponent,
    lastError,
    coachUnavailable,
  });
  const detail = detailFor({
    mode,
    status,
    terminalReason: effectiveReason,
    opponent,
    lastError,
    coachUnavailable,
  });

  return (
    <section
      aria-label="Game status"
      className="flex flex-col gap-3"
      data-testid="status-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={badgeVariant(mode, opponent)}
          data-testid="status-badge"
          data-mode={mode}
          data-opponent-phase={opponent.phase}
          data-opponent-source={opponent.activeSource ?? "none"}
        >
          {badgeLabel(mode, opponent)}
        </Badge>
        {opponent.activeSource ? (
          <Badge variant="outline" data-testid="opponent-source-badge">
            vs {opponent.activeSource === "maia" ? "Maia" : "Stockfish"}
          </Badge>
        ) : null}
        {coachUnavailable ? (
          <Badge
            variant="outline"
            data-testid="coach-unavailable-badge"
            className="text-amber-800 dark:text-amber-200"
          >
            Coach unavailable
          </Badge>
        ) : null}
        {status.isCheck && !status.isGameOver ? (
          <Badge variant="destructive" data-testid="check-badge">
            Check
          </Badge>
        ) : null}
      </div>

      <div>
        <p className="font-heading text-lg font-medium tracking-tight">
          {headline}
        </p>
        {detail ? (
          <p
            className={cn(
              "mt-1 text-sm text-muted-foreground",
              opponent.fallbackReason && "text-amber-800 dark:text-amber-200",
            )}
            data-testid="status-detail"
          >
            {detail}
          </p>
        ) : null}
      </div>

      {opponent.phase === "starting" ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Engine loading"
          aria-valuetext={opponent.message ?? "Loading"}
          data-testid="engine-progress"
        >
          <div
            className={cn(
              "h-full w-1/2 rounded-full bg-primary",
              "motion-safe:animate-pulse",
            )}
          />
        </div>
      ) : null}
    </section>
  );
}

function badgeVariant(
  mode: SessionMode,
  opponent: OpponentControllerState,
): "default" | "secondary" | "destructive" | "outline" {
  if (mode === "error" || opponent.phase === "failed") return "destructive";
  if (mode === "gameOver") return "secondary";
  if (opponent.fallbackReason) return "outline";
  return "default";
}

function badgeLabel(
  mode: SessionMode,
  opponent: OpponentControllerState,
): string {
  if (opponent.phase === "starting") return "Loading engines";
  if (opponent.phase === "failed" || mode === "error") return "Error";
  if (mode === "gameOver") return "Game over";
  if (mode === "opponentThinking" || opponent.phase === "thinking") {
    return "Opponent thinking";
  }
  if (mode === "playerTurn") return "Your turn";
  if (mode === "loading") return "Ready to start";
  return mode;
}

function headlineFor(
  args: StatusPanelProps & { terminalReason: GameStatusReason },
): string {
  const { mode, status, terminalReason, opponent, lastError } = args;
  if (opponent.phase === "failed" || mode === "error") {
    return lastError ?? opponent.message ?? "Something went wrong";
  }
  if (mode === "gameOver") {
    if (terminalReason === "resignation") return "You resigned";
    if (status.result === "whiteWins") return "You won";
    if (status.result === "blackWins") return "Black won";
    if (status.result === "draw") return "Draw";
    return "Game over";
  }
  if (opponent.phase === "starting") {
    return opponent.message ?? "Starting engines…";
  }
  if (mode === "opponentThinking") {
    if (opponent.activeSource === "stockfish") {
      return "Stockfish is thinking…";
    }
    if (opponent.activeSource === "maia") {
      return "Maia is thinking…";
    }
    return "Opponent is thinking…";
  }
  if (mode === "playerTurn") return "Your move";
  if (mode === "loading") return "Start a game when you are ready";
  return "Chess Tutor";
}

function detailFor(
  args: StatusPanelProps & { terminalReason: GameStatusReason },
): string | null {
  const { mode, status, terminalReason, opponent, lastError, coachUnavailable } =
    args;
  if (opponent.fallbackReason) return opponent.fallbackReason;
  if (coachUnavailable) return coachUnavailable;
  if (lastError) return lastError;
  if (mode === "gameOver") {
    return reasonCopy({ ...status, reason: terminalReason });
  }
  if (opponent.phase === "starting") {
    return "The board is ready. Engines load only after you press Start.";
  }
  if (mode === "loading") {
    return "Play as White against Maia. Stockfish is the automatic fallback.";
  }
  return opponent.message;
}

function reasonCopy(status: GameStatus): string {
  switch (status.reason) {
    case "checkmate":
      return status.result === "whiteWins"
        ? "Checkmate — White wins."
        : "Checkmate — Black wins.";
    case "stalemate":
      return "Stalemate.";
    case "threefold":
      return "Draw by threefold repetition.";
    case "fiftyMove":
      return "Draw by fifty-move rule.";
    case "insufficientMaterial":
      return "Draw by insufficient material.";
    case "resignation":
      return "Resignation ends the game.";
    default:
      return status.reason === "draw" ? "Drawn game." : "Game finished.";
  }
}
