import { describe, expect, it } from "vitest";
import { LICHESS_MOTIF_FIXTURES } from "@/domain/analysis/motif-precision";
import { buildMoveAnalysisEvidence } from "@/domain/analysis/move-analysis";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { tryApplyMove } from "@/domain/game/rules";
import { puzzleToScenarios } from "@/domain/teaching/coaching-dump";
import { selectTeachingInsight } from "@/domain/teaching/select-insight";

function evidence(
  fen: string,
  score: AnalysisEvidence["score"],
  bestMoveUci: string,
  pv: string[] = [bestMoveUci],
  extraLines: AnalysisEvidence["lines"] = [],
): AnalysisEvidence {
  return {
    requestId: "corpus",
    gameNodeId: "corpus-node",
    fen,
    sideToMove: fen.split(" ")[1] === "b" ? "b" : "w",
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
) {
  const applied = tryApplyMove(fen, playedUci);
  if (!applied) throw new Error(`illegal ${playedUci} in ${fen}`);
  return selectTeachingInsight(
    buildMoveAnalysisEvidence({
      requestId: "corpus",
      gameNodeId: "corpus-node",
      playedMove: applied.move,
      fenBefore: fen,
      fenAfter: applied.fenAfter,
      before,
      after,
    }),
  );
}

describe("golden coaching corpus", () => {
  it("explains e4 with a concrete center reason, not SAN", () => {
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
    expect(insight.explanation.toLowerCase()).toMatch(/pawn to e4/);
    expect(insight.explanation.toLowerCase()).toMatch(/because/);
    expect(insight.explanation).not.toMatch(/centipawn/i);
    expect(insight.explanation).not.toMatch(/^[NBRQK]?[a-h][1-8] is /);
  });

  it("names the hanging queen and the recapture when White ignores g6", () => {
    const fenBefore =
      "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";
    const g6 = tryApplyMove(fenBefore, "g7g6")!;
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
    expect(insight.explanation.toLowerCase()).toMatch(/queen/);
    expect(insight.explanation.toLowerCase()).toMatch(/because|hanging|attack/);
    expect(insight.explanation).not.toMatch(/keeps more of your advantage/i);
  });

  it("prefers mate language when the engine reports mate", () => {
    const fen = "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1";
    const insight = insightFor(
      fen,
      "e1e8",
      evidence(fen, { mate: 1 }, "e1e8"),
      evidence("4R1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1", { mate: 0 }, "g8h7"),
    );
    expect(insight.explanation.toLowerCase()).toMatch(/mate|checkmate|rook/);
    expect(insight.explanation.toLowerCase()).toMatch(/because/);
  });

  it("does not restate a capture as its own because", () => {
    const fen =
      "r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4";
    const afterFen =
      "r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4";
    const insight = insightFor(
      fen,
      "f3d4",
      evidence(
        fen,
        { cp: 40 },
        "f3d4",
        ["f3d4"],
        [{ multipv: 2, score: { cp: 35 }, pvUci: ["c2c3"] }],
      ),
      evidence(afterFen, { cp: 40 }, "c6d4"),
    );
    expect(insight.explanation.toLowerCase()).toMatch(/taking the pawn on d4/);
    expect(insight.explanation).not.toMatch(/because you take the pawn on d4/i);
    expect(insight.explanation).not.toMatch(/\bis a excellent\b/);
  });

  it("does not repeat the same because for the played and suggested move", () => {
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
    const afterFen =
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
    const insight = insightFor(
      fen,
      "g1f3",
      evidence(
        fen,
        { cp: 40 },
        "d2d4",
        ["d2d4"],
        [{ multipv: 2, score: { cp: 32 }, pvUci: ["g1f3"] }],
      ),
      evidence(afterFen, { cp: 30 }, "b8c6"),
    );
    expect(insight.explanation).not.toMatch(/\bis a excellent\b/);
    expect(insight.explanation).toMatch(
      /excellent move|strongest move|strong moves/i,
    );
    const becauses = [...insight.explanation.matchAll(/because ([^.]+)/gi)].map(
      (match) => match[1]!.trim().toLowerCase(),
    );
    if (becauses.length >= 2) {
      expect(becauses[0]).not.toBe(becauses[1]);
    }
    expect(insight.explanation).not.toMatch(
      /because you claim more of the center[\s\S]*because you claim more of the center/i,
    );
    expect(insight.explanation).not.toMatch(
      /because you control more central squares[\s\S]*because you control more central squares/i,
    );
  });

  it("never emits the old SAN-and-eval templates", () => {
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
    expect(insight.explanation).not.toMatch(/Nh4/);
    expect(insight.explanation).not.toMatch(/O-O/);
    expect(insight.explanation).not.toMatch(/keeps more of your advantage/i);
    expect(insight.explanation.toLowerCase()).toMatch(
      /because|castle|king|knight/,
    );
  });

  it("explains a winning skewer without calling the best move a hanging", () => {
    const fen = "4r3/8/8/8/8/8/4k3/R6K w - - 0 1";
    const insight = insightFor(
      fen,
      "a1e1",
      evidence(fen, { mate: 1 }, "a1e1", ["a1e1"]),
      evidence("4R3/8/8/8/8/8/4k3/7K b - - 1 1", { mate: 0 }, "e2e1"),
    );
    expect(insight.classification).toBe("best");
    expect(insight.explanation.toLowerCase()).toMatch(/skewer|check|rook/);
    expect(insight.explanation.toLowerCase()).not.toMatch(
      /puts it at risk of attack/,
    );
  });

  it("covers major motifs with plain-English copy", () => {
    for (const fixture of LICHESS_MOTIF_FIXTURES) {
      const [best] = puzzleToScenarios(fixture);
      if (!best) throw new Error(`missing dump scenario for ${fixture.id}`);
      const insight = insightFor(
        best.fen,
        best.playedUci,
        evidence(
          best.fen,
          best.before.score,
          best.before.bestMoveUci ?? best.playedUci,
          best.before.lines[0]?.pvUci,
          best.before.lines.slice(1),
        ),
        evidence(
          tryApplyMove(best.fen, best.playedUci)!.fenAfter,
          best.after.score,
          best.after.bestMoveUci ?? best.playedUci,
          best.after.lines[0]?.pvUci,
        ),
      );
      expect(insight.explanation.length).toBeGreaterThan(12);
      expect(insight.explanation).not.toMatch(/centipawn/i);
      expect(insight.explanation).not.toMatch(/\bis a excellent\b/);
    }
  });
});
