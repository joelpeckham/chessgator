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
  it("keeps a follow-up capture from the improvement line as likely", () => {
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
        (reason) => reason.kind === "pin" && reason.pinned.type === "n",
      ),
    ).toBe(false);
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
        defenderCount: 0,
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

  it("reports a missed mate when the best line is not a mate", () => {
    expect(
      pickMateBenefits({
        evalBefore: { mate: 2 },
        bestLineScore: { cp: 40 },
        mover: "w",
      }),
    ).toEqual([{ kind: "missed_mate", mateIn: 2 }]);
  });

  it("flags material lost across the refutation from the player's view", () => {
    const fen = "4k3/8/8/8/8/8/8/3QK3 w - - 0 1";
    const applied = tryApplyMove(fen, "e1f1")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    const reasons = pickProblemReasons(effects, [], {
      refutationNetCp: -900,
    });
    expect(
      reasons.some(
        (reason) =>
          reason.kind === "refutation_material" && reason.netCp === -900,
      ),
    ).toBe(true);
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

  it("does not call a recapture of an equal pawn a material win", () => {
    const previous = tryApplyMove(
      "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
      "c4d5",
    )!;
    const before = previous.fenAfter;
    const applied = tryApplyMove(before, "e6d5")!;
    const effects = collectMoveEffects({
      fenBefore: before,
      move: applied.move,
      fenAfter: applied.fenAfter,
      previousMove: previous.move,
    });
    expect(effects.isRecapture).toBe(true);
    const reasons = pickBenefitReasons(effects, []);
    expect(reasons.some((reason) => reason.kind === "wins_material")).toBe(
      false,
    );
  });

  it("names the origin square when a piece retreats to safety", () => {
    const fen = "4k3/8/b7/8/8/8/8/R3K3 b - - 0 1";
    const applied = tryApplyMove(fen, "a6c8")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    expect(effects.retreatedToSafety).toBe(true);
    const reasons = pickBenefitReasons(effects, []);
    const save = reasons.find((reason) => reason.kind === "saves_piece");
    expect(save?.kind === "saves_piece" && save.origin).toBe("a6");
    expect(save?.kind === "saves_piece" && save.piece.square).toBe("a6");
  });

  it("treats the King's Gambit pawn as an offer, not a hanging blunder", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    const applied = tryApplyMove(fen, "f2f4")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    expect(effects.gambitOffer).not.toBeNull();
    expect(effects.movedPieceHanging).toBeNull();
    const reasons = pickBenefitReasons(effects, []);
    expect(reasons.some((reason) => reason.kind === "gambit_offer")).toBe(true);
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

  it("ranks check above a pawn-to-rook pin", () => {
    expect(reasonSeverity({ kind: "check" })).toBeGreaterThan(
      reasonSeverity({
        kind: "pin",
        pinned: { type: "p", color: "b", square: "e5" },
        target: { type: "r", color: "b", square: "e8" },
        pinner: { type: "b", color: "w", square: "a1" },
      }),
    );
  });

  it("drops center control when a kick is present", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const applied = tryApplyMove(fen, "g7g6")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    const reasons = pickBenefitReasons(effects, []);
    expect(reasons.some((reason) => reason.kind === "kicks_piece")).toBe(true);
    expect(reasons.some((reason) => reason.kind === "center_control")).toBe(
      false,
    );
  });

  it("treats walking the king out of check as escaping, not saving a piece", () => {
    const fen = "4k3/8/8/8/8/8/8/4R2K b - - 0 1";
    const applied = tryApplyMove(fen, "e8f8")!;
    const effects = collectMoveEffects({
      fenBefore: fen,
      move: applied.move,
      fenAfter: applied.fenAfter,
    });
    expect(effects.escapedCheck).toBe(true);
    const reasons = pickBenefitReasons(effects, []);
    expect(reasons.some((reason) => reason.kind === "escapes_check")).toBe(
      true,
    );
    expect(reasons.some((reason) => reason.kind === "saves_piece")).toBe(false);
  });
});
