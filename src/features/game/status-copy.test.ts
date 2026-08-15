import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION, getStatus, tryApplyMove } from "@/domain/game";
import type { MaiaSessionState } from "@/features/game/maia-session";
import { getStatusPresentation } from "@/features/game/status-copy";

const readyMaia: MaiaSessionState = { phase: "ready", message: "Maia ready" };

function foolsMateStatus() {
  let fen = DEFAULT_POSITION;
  for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) {
    fen = tryApplyMove(fen, uci)!.fenAfter;
  }
  return getStatus(fen);
}

describe("getStatusPresentation", () => {
  it("reports White-human checkmate as a loss for Black's mate", () => {
    const status = foolsMateStatus();
    const presentation = getStatusPresentation({
      mode: "gameOver",
      status,
      maia: readyMaia,
      lastError: null,
      humanColor: "w",
    });
    expect(presentation.headline).toBe("You lost");
  });

  it("reports Black-human checkmate as a win for Black's mate", () => {
    const status = foolsMateStatus();
    const presentation = getStatusPresentation({
      mode: "gameOver",
      status,
      maia: readyMaia,
      lastError: null,
      humanColor: "b",
    });
    expect(presentation.headline).toBe("You won");
  });

  it("labels the hydrate reviewing transient from session mode", () => {
    const status = getStatus(DEFAULT_POSITION);
    expect(
      getStatusPresentation({
        mode: "reviewing",
        status,
        maia: readyMaia,
        lastError: null,
      }).badgeLabel,
    ).toBe("Reviewing");
  });
});
