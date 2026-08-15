import { describe, expect, it } from "vitest";
import { collectTacticalFacts } from "@/domain/analysis/move-effects";
import { tryApplyMove } from "@/domain/game/rules";

describe("tactical facts", () => {
  it("detects checks and captures", () => {
    // Scholar's mate style check: after 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#
    const before =
      "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1N1 w KQkq - 4 4";
    const applied = tryApplyMove(before, "h5f7");
    expect(applied).not.toBeNull();
    const facts = collectTacticalFacts({
      fenBefore: before,
      move: applied!.move,
      fenAfter: applied!.fenAfter,
    });
    expect(facts.isCapture).toBe(true);
    expect(facts.gaveCheck).toBe(true);
  });

  it("detects a moved piece left hanging", () => {
    // Classic: White Q on h5, Black plays …g6 attacking it, White ignores with a3.
    const beforeQ =
      "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const g6 = tryApplyMove(beforeQ, "g7g6");
    expect(g6).not.toBeNull();
    const afterG6 = g6!.fenAfter;
    const ignore = tryApplyMove(afterG6, "a2a3");
    expect(ignore).not.toBeNull();
    const facts = collectTacticalFacts({
      fenBefore: afterG6,
      move: ignore!.move,
      fenAfter: ignore!.fenAfter,
    });
    expect(facts.ignoredThreat || facts.leftPieceHanging).toBe(true);
    expect(facts.hangingSquares).toContain("h5");
  });

  it("flags development off the back rank", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const applied = tryApplyMove(start, "g1f3");
    expect(applied).not.toBeNull();
    const facts = collectTacticalFacts({
      fenBefore: start,
      move: applied!.move,
      fenAfter: applied!.fenAfter,
    });
    expect(facts.developedPiece).toBe(true);
  });
});
