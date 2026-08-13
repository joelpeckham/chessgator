import { describe, expect, it } from "vitest";
import { buildMoveAnalysisEvidence } from "@/domain/analysis/move-analysis";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { tryApplyMove } from "@/domain/game/rules";
import {
  chooseConcept,
  selectTeachingInsight,
} from "@/domain/teaching/select-insight";
import { renderExplanation } from "@/domain/teaching/templates";

function evidence(
  fen: string,
  score: AnalysisEvidence["score"],
  bestMoveUci: string,
  pv: string[] = [bestMoveUci],
): AnalysisEvidence {
  return {
    requestId: "t",
    gameNodeId: "n",
    fen,
    sideToMove: fen.split(" ")[1] === "b" ? "b" : "w",
    score,
    bestMoveUci,
    lines: [{ multipv: 1, score, pvUci: pv }],
  };
}

function expectQuality(text: string): void {
  expect(text.toLowerCase()).toContain("because");
  expect(text).not.toMatch(/keeps more of your advantage/i);
  expect(text).not.toMatch(/centipawn/i);
}

describe("teaching selection", () => {
  it("labels engine-best as best_move", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const applied = tryApplyMove(fen, "e2e4")!;
    const moveEvidence = buildMoveAnalysisEvidence({
      requestId: "r1",
      gameNodeId: "node-1",
      playedMove: applied.move,
      fenBefore: fen,
      fenAfter: applied.fenAfter,
      before: evidence(fen, { cp: 25 }, "e2e4"),
      after: evidence(applied.fenAfter, { cp: 30 }, "e7e5"),
    });
    expect(chooseConcept(moveEvidence)).toBe("best_move");
    const insight = selectTeachingInsight(moveEvidence);
    expect(insight.concept).toBe("best_move");
    expect(insight.nudge).toBe(false);
    expect(insight.quip).toBe("That's the one.");
    expect(insight.suggestedMoveUci).toBeNull();
    expectQuality(insight.explanation);
    expect(insight.explanation.toLowerCase()).toContain("pawn");
    expect(insight.explanation.toLowerCase()).toMatch(
      /strongest move|one of several strong moves/,
    );
    expect(insight.explanation.toLowerCase()).toMatch(/central squares|center/);
    expect(insight.explanation).not.toMatch(/\bis a excellent\b/);
  });

  it("selects piece_safety when a hanging piece is left", () => {
    const fenBefore =
      "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const g6 = tryApplyMove(fenBefore, "g7g6")!;
    // White ignores the attack on the queen.
    const ignore = tryApplyMove(g6.fenAfter, "a2a3")!;
    const moveEvidence = buildMoveAnalysisEvidence({
      requestId: "r2",
      gameNodeId: "node-2",
      playedMove: ignore.move,
      fenBefore: g6.fenAfter,
      fenAfter: ignore.fenAfter,
      before: evidence(g6.fenAfter, { cp: -120 }, "h5e5", ["h5e5"]),
      after: evidence(ignore.fenAfter, { cp: -900 }, "g6h5", ["g6h5"]),
    });
    expect(moveEvidence.classification).toBe("blunder");
    const concept = chooseConcept(moveEvidence);
    expect(["piece_safety", "threat", "missed_improvement"]).toContain(concept);
    const insight = selectTeachingInsight(moveEvidence);
    expect(insight.nudge).toBe(true);
    expect(insight.suggestedMoveUci).toBe("h5e5");
    expect(insight.lineUci[0]).toBe("h5e5");
    expect(insight.lineUci).not.toContain("a2a3");
    expect(insight.refutationUci[0]).toBe("g6h5");
    expectQuality(insight.explanation);
    expect(insight.explanation.toLowerCase()).toMatch(/queen|pawn/);
    expect(insight.explanation.toLowerCase()).toContain("moving your pawn");
  });

  it("explains a hanging knight versus kingside castling", () => {
    const fen =
      "r1bqk2r/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const played = tryApplyMove(fen, "f3h4")!;
    expect(played).toBeTruthy();
    const moveEvidence = buildMoveAnalysisEvidence({
      requestId: "r3",
      gameNodeId: "node-3",
      playedMove: played.move,
      fenBefore: fen,
      fenAfter: played.fenAfter,
      before: evidence(fen, { cp: 40 }, "e1g1", ["e1g1"]),
      after: evidence(played.fenAfter, { cp: -180 }, "d8h4", ["d8h4"]),
    });
    const insight = selectTeachingInsight(moveEvidence);
    expectQuality(insight.explanation);
    expect(insight.explanation.toLowerCase()).toMatch(/knight/);
    expect(insight.explanation.toLowerCase()).toMatch(
      /castle|king|rook|safer|danger/,
    );
  });

  it("templates render classification without Maia likelihood", () => {
    const text = renderExplanation({
      playedPhrase: "moving your knight to f3",
      suggestedPhrase: null,
      problem: null,
      consequence: null,
      playedBecause: "it develops your knight",
      suggestedBecause: null,
      classification: "good",
      concept: "solid_move",
      evalFrame: null,
      margin: null,
    });
    expect(text).toMatch(/knight to f3/);
    expect(text).toMatch(/because/);
    expect(text).not.toMatch(
      /model-predicted likelihood|population frequency/i,
    );
  });
});
