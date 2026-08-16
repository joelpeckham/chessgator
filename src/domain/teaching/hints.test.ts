import { describe, expect, it } from "vitest";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import {
  buildHintStep,
  buildInitialHintStep,
  nextHintActionLabel,
  nextHintLevel,
} from "@/domain/teaching/hints";

const fen = "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";

const analysis: AnalysisEvidence = {
  requestId: "h",
  gameNodeId: "g",
  fen,
  sideToMove: "b",
  score: { cp: -40 },
  bestMoveUci: "g7g6",
  lines: [{ multipv: 1, score: { cp: -40 }, pvUci: ["g7g6", "h5e5"] }],
};

describe("hint escalation", () => {
  it("escalates squares → candidate → line", () => {
    const l1 = buildHintStep({
      fen,
      sideToMove: "b",
      positionAnalysis: analysis,
      level: 1,
    });
    expect(l1.highlightSquares.length).toBeGreaterThan(0);
    expect(l1.candidateMoveUci).toBeNull();
    expect(l1.lineUci).toEqual([]);

    const l2 = buildHintStep({
      fen,
      sideToMove: "b",
      positionAnalysis: analysis,
      level: 2,
    });
    expect(l2.candidateMoveUci).toBe("g7g6");
    expect(l2.candidateMoveSan).toBe("g6");

    const l3 = buildHintStep({
      fen,
      sideToMove: "b",
      positionAnalysis: analysis,
      level: 3,
    });
    expect(l3.lineUci[0]).toBe("g7g6");
  });

  it("caps hint level at 3", () => {
    expect(nextHintLevel(0)).toBe(1);
    expect(nextHintLevel(3)).toBe(3);
  });

  it("names the next hint action", () => {
    expect(nextHintActionLabel(-1)).toBe("Hint");
    expect(nextHintActionLabel(1)).toBe("Show move");
    expect(nextHintActionLabel(2)).toBe("Show line");
  });

  it("starts on the candidate when there is no question to read", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const step = buildInitialHintStep({
      fen: start,
      sideToMove: "w",
      positionAnalysis: {
        requestId: "h",
        gameNodeId: "g",
        fen: start,
        sideToMove: "w",
        score: { cp: 30 },
        bestMoveUci: "e2e4",
        lines: [{ multipv: 1, score: { cp: 30 }, pvUci: ["e2e4"] }],
      },
    });
    expect(step.question).toBe("");
    expect(step.level).toBe(2);
    expect(step.candidateMoveSan).toBe("e4");
  });

  it("asks a pin-specific question and highlights the pinner", () => {
    const pinFen = "4k3/4n3/8/8/8/8/8/R6K w - - 0 1";
    const step = buildHintStep({
      fen: pinFen,
      sideToMove: "w",
      positionAnalysis: {
        requestId: "h",
        gameNodeId: "g",
        fen: pinFen,
        sideToMove: "w",
        score: { cp: 300 },
        bestMoveUci: "a1e1",
        lines: [{ multipv: 1, score: { cp: 300 }, pvUci: ["a1e1"] }],
      },
      level: 1,
    });
    expect(step.question.toLowerCase()).toMatch(/pin/);
    expect(step.question.toLowerCase()).not.toMatch(/hit two targets at once/);
    expect(step.highlightSquares).toEqual(
      expect.arrayContaining(["e1", "e7", "e8"]),
    );
    expect(
      buildInitialHintStep({
        fen: pinFen,
        sideToMove: "w",
        positionAnalysis: {
          requestId: "h",
          gameNodeId: "g",
          fen: pinFen,
          sideToMove: "w",
          score: { cp: 300 },
          bestMoveUci: "a1e1",
          lines: [{ multipv: 1, score: { cp: 300 }, pvUci: ["a1e1"] }],
        },
      }).level,
    ).toBe(1);
  });
});
