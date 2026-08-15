import { describe, expect, it } from "vitest";
import { buildMoveAnalysisEvidence } from "@/domain/analysis/move-analysis";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { sideToMoveFromFen, tryApplyMove } from "@/domain/game/rules";
import type { GameMove } from "@/domain/game/types";
import { describeBecause } from "@/domain/teaching/move-copy";
import { selectTeachingInsight } from "@/domain/teaching/select-insight";

function evidence(
  fen: string,
  score: AnalysisEvidence["score"],
  bestMoveUci: string,
  pv: string[] = [bestMoveUci],
  extraLines: AnalysisEvidence["lines"] = [],
): AnalysisEvidence {
  return {
    requestId: "swarm",
    gameNodeId: "swarm-node",
    fen,
    sideToMove: sideToMoveFromFen(fen),
    score,
    bestMoveUci,
    lines: [{ multipv: 1, score, pvUci: pv }, ...extraLines],
  };
}

function insightFor(
  fen: string,
  playedUci: string,
  before: AnalysisEvidence,
  after: AnalysisEvidence,
  previousMove: GameMove | null = null,
) {
  const applied = tryApplyMove(fen, playedUci);
  if (!applied) throw new Error(`illegal ${playedUci} in ${fen}`);
  return selectTeachingInsight(
    buildMoveAnalysisEvidence({
      requestId: "swarm",
      gameNodeId: "swarm-node",
      playedMove: applied.move,
      previousMove,
      fenBefore: fen,
      fenAfter: applied.fenAfter,
      before,
      after,
    }),
  );
}

describe("swarm-flag golden cases", () => {
  it("does not call a defended pawn undefended", () => {
    const fen =
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const insight = insightFor(
      fen,
      "f3e5",
      evidence(fen, { cp: 40 }, "d2d4", ["d2d4"]),
      evidence(tryApplyMove(fen, "f3e5")!.fenAfter, { cp: -80 }, "c6e5", [
        "c6e5",
      ]),
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(/undefended/);
  });

  it("does not praise a blunder with its capture upside", () => {
    const fen =
      "r1bqk2r/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const insight = insightFor(
      fen,
      "f3h4",
      evidence(fen, { cp: 40 }, "e1g1", ["e1g1"]),
      evidence(tryApplyMove(fen, "f3h4")!.fenAfter, { cp: -180 }, "d8h4", [
        "d8h4",
      ]),
    );
    expect(insight.classification).not.toBe("best");
    expect(insight.explanation.toLowerCase()).not.toMatch(
      /is a (mistake|blunder|inaccuracy) because you take/,
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(
      /because it develops/,
    );
  });

  it("explains mate without also calling it a fork", () => {
    const fen = "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1";
    const insight = insightFor(
      fen,
      "e1e8",
      evidence(fen, { mate: 1 }, "e1e8"),
      evidence("4R1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1", { mate: 0 }, "g8h7"),
    );
    expect(insight.explanation.toLowerCase()).toMatch(/mate|checkmate/);
    expect(insight.explanation.toLowerCase().match(/checkmate/g)?.length).toBe(
      1,
    );
  });

  it("does not force best on a matching UCI with a 150cp swing", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const applied = tryApplyMove(fen, "a2a3")!;
    const insight = insightFor(
      fen,
      "a2a3",
      evidence(fen, { cp: 25 }, "a2a3", ["a2a3"]),
      evidence(applied.fenAfter, { cp: -130 }, "e7e5"),
    );
    expect(insight.classification).not.toBe("best");
    expect(insight.explanation.toLowerCase()).not.toMatch(/strongest move/);
    expect(insight.explanation.toLowerCase()).not.toMatch(/keeps you winning/);
  });

  it("names a retreating bishop from its origin, not the destination", () => {
    const fen = "4k3/8/b7/8/8/8/8/R3K3 b - - 0 1";
    const insight = insightFor(
      fen,
      "a6c8",
      evidence(fen, { cp: 50 }, "a6c8"),
      evidence(tryApplyMove(fen, "a6c8")!.fenAfter, { cp: 40 }, "a1a8"),
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(/c8-bishop/);
    expect(insight.explanation.toLowerCase()).not.toMatch(
      /saves your c8 bishop/,
    );
  });

  it("does not attach a later PV pin to the first SAN", () => {
    const fen = "4k3/4n3/8/3p4/4P3/7p/8/R6K w - - 0 1";
    const insight = insightFor(
      fen,
      "e4d5",
      evidence(fen, { cp: 80 }, "e4d5", ["e4d5", "h3h2", "a1e1"]),
      evidence(tryApplyMove(fen, "e4d5")!.fenAfter, { cp: 90 }, "h3h2"),
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(/likely pin/);
  });

  it("always has a because on a developing best move", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const insight = insightFor(
      fen,
      "e2e4",
      evidence(fen, { cp: 25 }, "e2e4"),
      evidence(
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        { cp: 30 },
        "e7e5",
      ),
    );
    expect(insight.explanation.toLowerCase()).toMatch(/because/);
    expect(insight.quip.length).toBeGreaterThan(0);
  });

  it("does not claim uniqueness without a because on a quiet best move", () => {
    const fen = "4k3/8/8/8/8/4P3/8/4K3 w - - 0 1";
    const insight = insightFor(
      fen,
      "e1e2",
      evidence(fen, { cp: 0 }, "e1e2"),
      evidence(tryApplyMove(fen, "e1e2")!.fenAfter, { cp: 0 }, "e8e7"),
    );
    if (!insight.explanation.toLowerCase().includes("because")) {
      expect(insight.explanation.toLowerCase()).not.toMatch(/strongest move/);
      expect(insight.quip).toBe("");
    }
  });

  it("frames an equal recapture as restoring the balance, not winning a piece", () => {
    const prevFen =
      "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3";
    const previous = tryApplyMove(prevFen, "c4d5")!;
    const insight = insightFor(
      previous.fenAfter,
      "e6d5",
      evidence(previous.fenAfter, { cp: 20 }, "e6d5"),
      evidence(
        tryApplyMove(previous.fenAfter, "e6d5")!.fenAfter,
        { cp: 15 },
        "e2e3",
      ),
      previous.move,
    );
    const text = insight.explanation.toLowerCase();
    expect(text).not.toMatch(/undefended/);
    expect(text).not.toMatch(/come out a (pawn|knight|bishop) ahead/);
    expect(text).not.toMatch(/you take because/);
  });

  it("names a pawn kick of the queen instead of center control", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const insight = insightFor(
      fen,
      "g7g6",
      evidence(fen, { cp: 50 }, "g7g6"),
      evidence(tryApplyMove(fen, "g7g6")!.fenAfter, { cp: 80 }, "h5e2"),
    );
    expect(insight.explanation.toLowerCase()).toMatch(
      /kick|chase|attacks the queen/,
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(/central squares/);
  });

  it("explains blocking a check as blocking, not fleeing", () => {
    const fen = "4k3/8/6n1/8/8/8/8/4R2K b - - 0 1";
    const insight = insightFor(
      fen,
      "g6e7",
      evidence(fen, { cp: 0 }, "g6e7"),
      evidence(tryApplyMove(fen, "g6e7")!.fenAfter, { cp: 0 }, "h1g1"),
    );
    expect(insight.explanation.toLowerCase()).toMatch(
      /blocks the check|block the check/,
    );
  });

  it("does not print still-winning framing on a teachable move", () => {
    const fen =
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const insight = insightFor(
      fen,
      "f3h4",
      evidence(fen, { cp: 40 }, "d2d4"),
      evidence(tryApplyMove(fen, "f3h4")!.fenAfter, { cp: -180 }, "d8h4"),
    );
    expect(["inaccuracy", "mistake", "blunder"]).toContain(
      insight.classification,
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(/keeps you winning/);
    expect(insight.explanation.toLowerCase()).not.toMatch(/still winning/);
  });
});

describe("pipeline invariants", () => {
  it("never frames a teachable move as a benefit capture slogan", () => {
    const fen =
      "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    const insight = insightFor(
      fen,
      "f3e5",
      evidence(fen, { cp: 40 }, "d2d4", ["d2d4"]),
      evidence(tryApplyMove(fen, "f3e5")!.fenAfter, { cp: -180 }, "c6e5", [
        "c6e5",
      ]),
    );
    expect(["inaccuracy", "mistake", "blunder"]).toContain(
      insight.classification,
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(
      /is a (mistake|blunder|inaccuracy) because you take/,
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(
      /because the pawn was undefended/,
    );
  });

  it("does not teach the Albin pawn offer as a hanging piece", () => {
    const fen = "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2";
    const insight = insightFor(
      fen,
      "e7e5",
      evidence(fen, { cp: 0 }, "e7e6", ["e7e6"]),
      evidence(tryApplyMove(fen, "e7e5")!.fenAfter, { cp: 90 }, "d4e5"),
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(/undefended/);
    expect(insight.explanation.toLowerCase()).not.toMatch(
      /puts it at risk of attack/,
    );
  });

  it("does not explain Bh4+ as a blunder because it checks", () => {
    const fen =
      "rn1qk2r/pppbbppp/8/4pP2/4P1n1/2N2N2/PPP3PP/R2QKBBR b KQkq - 0 9";
    const insight = insightFor(
      fen,
      "e7h4",
      evidence(fen, { cp: 70 }, "d7c6", ["d7c6"]),
      evidence(tryApplyMove(fen, "e7h4")!.fenAfter, { cp: 400 }, "g2h3"),
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(
      /blunder because it puts the opponent in check/,
    );
    expect(insight.explanation.toLowerCase()).not.toMatch(
      /forces the king to respond/,
    );
  });

  it("never uses the tautological check phrase", () => {
    expect(describeBecause([{ kind: "check" }], "w")).not.toMatch(
      /forces the king to respond/,
    );
  });

  it("does not print a suggested SAN without a because", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const g6 = tryApplyMove(fen, "g7g6")!;
    const insight = insightFor(
      g6.fenAfter,
      "a2a3",
      evidence(g6.fenAfter, { cp: -120 }, "h5e5", ["h5e5"]),
      evidence(
        tryApplyMove(g6.fenAfter, "a2a3")!.fenAfter,
        { cp: -900 },
        "g6h5",
        ["g6h5"],
      ),
    );
    const better = insight.explanation.match(
      /a better move would have been ([^.]+)\./i,
    );
    if (better) {
      expect(better[0].toLowerCase()).toMatch(/because/);
    }
  });
});
