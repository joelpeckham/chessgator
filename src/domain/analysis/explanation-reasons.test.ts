import { describe, expect, it } from "vitest";
import {
  classifyEvalFrame,
  classifyMoveMargin,
  contrastBenefits,
  dropTautologyReasons,
  pickBenefitReasons,
  pickMateBenefits,
  pickProblemReasons,
  reasonSeverity,
  verifyLikelyTactics,
} from "@/domain/analysis/explanation-reasons";
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

  it("ranks forced mate above hanging material", () => {
    expect(reasonSeverity({ kind: "allows_mate", mateIn: 2 })).toBeGreaterThan(
      reasonSeverity({
        kind: "hanging",
        piece: { type: "q", color: "w", square: "h5" },
        attackers: [{ type: "p", color: "b", square: "g6" }],
        seeCp: 800,
      }),
    );
  });

  it("surfaces mate-in-N from engine scores", () => {
    expect(
      pickMateBenefits({
        evalBefore: { mate: 3 },
        bestLineScore: { mate: 3 },
        mover: "w",
      }),
    ).toEqual([{ kind: "forces_mate", mateIn: 3 }]);
  });

  it("flags a move that allows mate", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2";
    const applied = tryApplyMove(fen, "d8h4")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    const reasons = pickProblemReasons(effects, [], {
      evalAfter: { mate: 1 },
    });
    expect(
      reasons.some(
        (reason) => reason.kind === "allows_mate" && reason.mateIn === 1,
      ),
    ).toBe(true);
  });

  it("drops unverified likely tactics when the eval barely moved", () => {
    const verified = verifyLikelyTactics(
      [
        {
          kind: "capture",
          captured: { type: "n", color: "b", square: "d5" },
          likely: true,
        },
      ],
      20,
    );
    expect(verified).toEqual([]);
  });

  it("keeps suggested benefits the played move lacks", () => {
    const contrasted = contrastBenefits(
      [{ kind: "castle", side: "kingside" }, { kind: "center_control" }],
      [{ kind: "center_control" }],
    );
    expect(contrasted).toEqual([{ kind: "castle", side: "kingside" }]);
  });

  it("returns no suggested benefits when they all overlap the played move", () => {
    expect(
      contrastBenefits(
        [
          { kind: "center_control" },
          {
            kind: "development",
            piece: { type: "n", color: "w", square: "f3" },
          },
        ],
        [
          { kind: "center_control" },
          {
            kind: "development",
            piece: { type: "n", color: "w", square: "c3" },
          },
        ],
      ),
    ).toEqual([]);
  });

  it("drops an immediate capture that restates the move itself", () => {
    const fen = "4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1";
    const applied = tryApplyMove(fen, "d1d5")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    const reasons = dropTautologyReasons(
      pickBenefitReasons(effects, []),
      applied.move,
    );
    expect(
      reasons.some((reason) => reason.kind === "capture" && !reason.likely),
    ).toBe(false);
    expect(reasons.some((reason) => reason.kind === "wins_material")).toBe(
      true,
    );
  });

  it("classifies MultiPV gaps and eval frames", () => {
    expect(
      classifyMoveMargin(
        [
          { multipv: 1, score: { cp: 40 }, pvUci: ["e2e4"] },
          { multipv: 2, score: { cp: -200 }, pvUci: ["a2a3"] },
        ],
        "w",
      ),
    ).toBe("only");
    expect(classifyEvalFrame({ cp: 300 }, { cp: 220 }, "w")).toBe(
      "still_winning",
    );
    expect(classifyEvalFrame({ cp: 120 }, { cp: -150 }, "w")).toBe(
      "hands_advantage",
    );
    expect(classifyEvalFrame({ cp: -200 }, { cp: -250 }, "w")).toBe(
      "still_losing",
    );
    expect(classifyEvalFrame({ cp: 20 }, { cp: -10 }, "w")).toBe("holds");
  });

  it("treats own overloads as problems and opponent overloads as benefits", () => {
    const fen = "2qk4/8/8/1p6/Q7/8/8/R1N4K w - - 0 1";
    const applied = tryApplyMove(fen, "h1h2")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    const problems = pickProblemReasons(effects);
    const benefits = pickBenefitReasons(effects, []);
    expect(problems.some((reason) => reason.kind === "overload")).toBe(true);
    expect(benefits.some((reason) => reason.kind === "overload")).toBe(false);
  });

  it("ranks an endgame passed pawn above a middlegame one", () => {
    expect(
      reasonSeverity({
        kind: "passed_pawn",
        piece: { type: "p", color: "w", square: "e6" },
        endgame: true,
      }),
    ).toBeGreaterThan(
      reasonSeverity({
        kind: "passed_pawn",
        piece: { type: "p", color: "w", square: "e6" },
      }),
    );
  });
});
