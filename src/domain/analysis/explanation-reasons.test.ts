import { describe, expect, it } from "vitest";
import { pickBenefitReasons } from "@/domain/analysis/explanation-reasons";
import {
  collectMoveEffects,
  walkLineEvents,
} from "@/domain/analysis/move-effects";
import { tryApplyMove } from "@/domain/game/rules";

describe("explanation reasons", () => {
  it("keeps a later pin from the improvement line as likely", () => {
    const fen = "4k3/4n3/8/3p4/4P3/7p/8/R6K w - - 0 1";
    const applied = tryApplyMove(fen, "e4d5")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    const events = walkLineEvents(fen, ["e4d5", "h3h2", "a1e1"]);
    expect(events[2]?.pins.some((pin) => pin.pinned.type === "n")).toBe(true);
    const reasons = pickBenefitReasons(effects, events);
    expect(
      reasons.some(
        (reason) =>
          reason.kind === "pin" && reason.likely && reason.pinned.type === "n",
      ),
    ).toBe(true);
    expect(
      reasons.some(
        (reason) => reason.kind === "capture" && reason.captured.type === "p",
      ),
    ).toBe(true);
  });
});
