import type { SessionMode, SessionState } from "@/domain/game/types";

/** Explicit legal session transitions. Orthogonal to the tree pointer. */
export const SESSION_TRANSITIONS: Readonly<
  Record<SessionMode, readonly SessionMode[]>
> = {
  loading: ["playerTurn", "opponentThinking", "error"],
  playerTurn: [
    "opponentThinking",
    "analyzing",
    "reviewing",
    "gameOver",
    "error",
  ],
  opponentThinking: [
    "playerTurn",
    "analyzing",
    "reviewing",
    "gameOver",
    "error",
  ],
  analyzing: [
    "playerTurn",
    "opponentThinking",
    "reviewing",
    "gameOver",
    "error",
  ],
  reviewing: [
    "playerTurn",
    "opponentThinking",
    "analyzing",
    "gameOver",
    "error",
  ],
  gameOver: ["reviewing", "loading", "playerTurn"],
  error: ["loading", "playerTurn"],
};

export function createSessionState(
  mode: SessionMode = "loading",
): SessionState {
  return {
    mode,
    errorMessage: null,
    terminalReason: null,
  };
}

export function canTransition(
  from: SessionMode,
  to: SessionMode,
): boolean {
  if (from === to) {
    return true;
  }
  return SESSION_TRANSITIONS[from].includes(to);
}

export function listTransitions(from: SessionMode): readonly SessionMode[] {
  return SESSION_TRANSITIONS[from];
}

export type TransitionResult =
  | { ok: true; session: SessionState }
  | { ok: false; session: SessionState; reason: string };

export function transitionSession(
  session: SessionState,
  to: SessionMode,
  options?: {
    errorMessage?: string | null;
    terminalReason?: SessionState["terminalReason"];
  },
): TransitionResult {
  if (!canTransition(session.mode, to)) {
    return {
      ok: false,
      session,
      reason: `Illegal session transition: ${session.mode} → ${to}`,
    };
  }

  const next: SessionState = {
    mode: to,
    errorMessage:
      to === "error"
        ? (options?.errorMessage ?? session.errorMessage ?? "Unknown error")
        : null,
    terminalReason:
      to === "gameOver"
        ? (options?.terminalReason ?? session.terminalReason)
        : to === "loading"
          ? null
          : session.terminalReason,
  };

  return { ok: true, session: next };
}

export function enterError(
  session: SessionState,
  message: string,
): TransitionResult {
  return transitionSession(session, "error", { errorMessage: message });
}
