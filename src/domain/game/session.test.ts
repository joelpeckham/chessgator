import { describe, expect, it } from "vitest";
import {
  SESSION_TRANSITIONS,
  canTransition,
  createSessionState,
  transitionSession,
} from "@/domain/game/session";
import type { SessionMode } from "@/domain/game/types";

describe("session state machine", () => {
  it("exposes legal transitions for every mode", () => {
    const modes = Object.keys(SESSION_TRANSITIONS) as SessionMode[];
    expect(modes).toEqual([
      "loading",
      "playerTurn",
      "opponentThinking",
      "analyzing",
      "reviewing",
      "gameOver",
      "error",
    ]);
    for (const mode of modes) {
      expect(SESSION_TRANSITIONS[mode].length).toBeGreaterThan(0);
      expect(canTransition(mode, mode)).toBe(true);
    }
  });

  it("allows playerTurn → opponentThinking and rejects illegal jumps", () => {
    const session = createSessionState("playerTurn");
    const ok = transitionSession(session, "opponentThinking");
    expect(ok.ok).toBe(true);
    expect(ok.session.mode).toBe("opponentThinking");

    const bad = transitionSession(session, "loading");
    expect(bad.ok).toBe(false);
  });

  it("records error messages only in error mode", () => {
    const session = createSessionState("playerTurn");
    const errored = transitionSession(session, "error", {
      errorMessage: "engine failed",
    });
    expect(errored.ok).toBe(true);
    expect(errored.session.errorMessage).toBe("engine failed");

    const recovered = transitionSession(errored.session, "loading");
    expect(recovered.ok).toBe(true);
    expect(recovered.session.errorMessage).toBeNull();
  });

  it("keeps terminalReason on gameOver and clears it on loading", () => {
    const session = createSessionState("playerTurn");
    const over = transitionSession(session, "gameOver", {
      terminalReason: "checkmate",
    });
    expect(over.ok).toBe(true);
    expect(over.session.terminalReason).toBe("checkmate");

    const restart = transitionSession(over.session, "loading");
    expect(restart.ok).toBe(true);
    expect(restart.session.terminalReason).toBeNull();
  });
});
