import type {
  GameMove,
  GameStatus,
  GameStatusReason,
  SessionMode,
} from "@/domain/game";
import type { MaiaSessionState } from "@/features/game/maia-session";

export type StatusPresentationInput = {
  mode: SessionMode;
  status: GameStatus;
  terminalReason?: GameStatusReason | null;
  maia: MaiaSessionState;
  lastError: string | null;
  coachUnavailable?: string | null;
  coachMessage?: string | null;
  lastMove?: GameMove | null;
  navigationMessage?: string | null;
  /** Polite coach classification / explanation announcement. */
  coachAnnouncement?: string | null;
  /** Polite hint escalation announcement. */
  hintAnnouncement?: string | null;
  enginesWarming?: boolean;
};

export type StatusPresentation = {
  headline: string;
  detail: string | null;
  announcement: string;
  badgeLabel: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
};

/**
 * Single source for status badge copy and live-region announcements.
 */
export function getStatusPresentation(
  args: StatusPresentationInput,
): StatusPresentation {
  const terminalReason = args.terminalReason ?? args.status.reason;
  const { mode, status, maia, lastError } = args;
  const coachUnavailable = args.coachUnavailable ?? null;

  const badgeVariant = badgeVariantFor(mode, maia);
  const badgeLabel = badgeLabelFor(mode, maia, args.enginesWarming);
  const headline = headlineFor({
    mode,
    status,
    terminalReason,
    maia,
    lastError,
  });
  const detail = detailFor({
    mode,
    status,
    terminalReason,
    maia,
    lastError,
    coachUnavailable,
    enginesWarming: args.enginesWarming,
  });

  let announcement: string;
  if (args.navigationMessage) {
    announcement = args.navigationMessage;
  } else if (args.coachAnnouncement) {
    announcement = args.coachAnnouncement;
  } else if (args.hintAnnouncement) {
    announcement = args.hintAnnouncement;
  } else if (mode === "gameOver") {
    announcement = detail ? `${headline}. ${detail}` : headline;
  } else if (maia.message && (mode === "loading" || args.enginesWarming)) {
    announcement = maia.message;
  } else if (mode === "analyzing" && args.coachMessage) {
    announcement = args.coachMessage;
  } else if (args.lastMove) {
    const who = args.lastMove.color === "w" ? "White" : "Black";
    announcement = `${who} played ${args.lastMove.san}`;
  } else {
    announcement = maia.message ?? headline;
  }

  return { headline, detail, announcement, badgeLabel, badgeVariant };
}

function badgeVariantFor(
  mode: SessionMode,
  maia: MaiaSessionState,
): StatusPresentation["badgeVariant"] {
  if (mode === "error" || maia.phase === "failed") return "destructive";
  if (mode === "gameOver") return "secondary";
  return "default";
}

function badgeLabelFor(
  mode: SessionMode,
  maia: MaiaSessionState,
  enginesWarming?: boolean,
): string {
  if (maia.phase === "failed" || mode === "error") return "Error";
  if (mode === "gameOver") return "Game over";
  if (mode === "opponentThinking" || maia.phase === "thinking") {
    return "Opponent thinking";
  }
  if (mode === "analyzing") return "Analyzing";
  if (mode === "reviewing") return "Reviewing";
  if (enginesWarming || maia.phase === "starting") return "Your turn";
  if (mode === "playerTurn") return "Your turn";
  if (mode === "loading") return "Starting";
  return mode;
}

function headlineFor(args: {
  mode: SessionMode;
  status: GameStatus;
  terminalReason: GameStatusReason;
  maia: MaiaSessionState;
  lastError: string | null;
}): string {
  const { mode, status, terminalReason, maia, lastError } = args;
  if (maia.phase === "failed" || mode === "error") {
    return lastError ?? maia.message ?? "Something went wrong";
  }
  if (mode === "gameOver") {
    if (terminalReason === "resignation") return "You resigned";
    if (status.result === "whiteWins") return "You won";
    if (status.result === "blackWins") return "Black won";
    if (status.result === "draw") return "Draw";
    return "Game over";
  }
  if (mode === "opponentThinking" || maia.phase === "thinking") {
    return "Maia is thinking…";
  }
  if (mode === "playerTurn" || mode === "loading") return "Your move";
  if (mode === "reviewing") return "Reviewing";
  if (mode === "analyzing") return "Analyzing…";
  return "chessgator";
}

function detailFor(args: {
  mode: SessionMode;
  status: GameStatus;
  terminalReason: GameStatusReason;
  maia: MaiaSessionState;
  lastError: string | null;
  coachUnavailable: string | null;
  enginesWarming?: boolean;
}): string | null {
  const {
    mode,
    status,
    terminalReason,
    maia,
    lastError,
    coachUnavailable,
    enginesWarming,
  } = args;
  if (coachUnavailable) return coachUnavailable;
  if (lastError) return lastError;
  if (mode === "gameOver") {
    return reasonCopy({ ...status, reason: terminalReason });
  }
  if (enginesWarming || maia.phase === "starting") {
    return maia.message ?? "Downloading engines in the background…";
  }
  return maia.message;
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
