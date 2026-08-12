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
    expect(insight.explanation.length).toBeGreaterThan(10);
  });

  it("templates render classification without Maia likelihood", () => {
    const text = renderExplanation("solid_move", {
      playedSan: "Nf3",
      suggestedSan: null,
      classification: "good",
      evalLossCp: 15,
    });
    expect(text).toMatch(/Nf3/);
    expect(text).not.toMatch(
      /model-predicted likelihood|population frequency/i,
    );
  });
});
