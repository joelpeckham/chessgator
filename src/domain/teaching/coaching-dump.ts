import {
  pickBenefitReasons,
  pickProblemReasons,
} from "@/domain/analysis/explanation-reasons";
import { buildMoveAnalysisEvidence } from "@/domain/analysis/move-analysis";
import { collectMoveEffects } from "@/domain/analysis/move-effects";
import type {
  AnalysisEvidence,
  EvaluationScore,
} from "@/domain/analysis/types";
import { createChess, tryApplyMove } from "@/domain/game/rules";
import { selectTeachingInsight } from "@/domain/teaching/select-insight";
import type { TeachingInsight } from "@/domain/teaching/types";

export type CoachingDumpRow = {
  id: string;
  fen: string;
  playedUci: string;
  explanation: string;
  reasons: string[];
  classification: TeachingInsight["classification"];
  concept: TeachingInsight["concept"];
};

export type DumpScenario = {
  id: string;
  fen: string;
  playedUci: string;
  before: Pick<AnalysisEvidence, "score" | "bestMoveUci" | "lines">;
  after: Pick<AnalysisEvidence, "score" | "bestMoveUci" | "lines">;
};

export function dumpScenario(scenario: DumpScenario): CoachingDumpRow | null {
  const applied = tryApplyMove(scenario.fen, scenario.playedUci);
  if (!applied) return null;
  const insight = selectTeachingInsight(
    buildMoveAnalysisEvidence({
      requestId: scenario.id,
      gameNodeId: scenario.id,
      playedMove: applied.move,
      fenBefore: scenario.fen,
      fenAfter: applied.fenAfter,
      before: evidence(scenario.fen, scenario.before),
      after: evidence(applied.fenAfter, scenario.after),
    }),
  );
  const effects = collectMoveEffects({
    fenBefore: scenario.fen,
    move: applied.move,
    fenAfter: applied.fenAfter,
  });
  const reasons = [
    ...pickProblemReasons(effects),
    ...pickBenefitReasons(effects, []),
  ].map((reason) => reason.kind);
  return {
    id: scenario.id,
    fen: scenario.fen,
    playedUci: scenario.playedUci,
    explanation: insight.explanation,
    reasons,
    classification: insight.classification,
    concept: insight.concept,
  };
}

export function puzzleToScenarios(puzzle: {
  id: string;
  fen: string;
  move: string;
  themes: string[];
}): DumpScenario[] {
  const solution = puzzle.move;
  if (!tryApplyMove(puzzle.fen, solution)) return [];
  const fen = puzzle.fen;
  const mate = puzzle.themes.some((theme) => /mate/i.test(theme));
  const side = fen.split(" ")[1] === "b" ? "b" : "w";
  const win: EvaluationScore = mate
    ? { mate: side === "w" ? 2 : -2 }
    : { cp: side === "w" ? 280 : -280 };
  const even: EvaluationScore = { cp: side === "w" ? 40 : -40 };
  const loss: EvaluationScore = { cp: side === "w" ? -220 : 220 };
  const wrong = firstWrongMove(fen, solution);
  const rows: DumpScenario[] = [
    {
      id: `${puzzle.id}:best`,
      fen,
      playedUci: solution,
      before: {
        score: even,
        bestMoveUci: solution,
        lines: [
          { multipv: 1, score: win, pvUci: [solution] },
          ...(wrong ? [{ multipv: 2, score: loss, pvUci: [wrong] }] : []),
        ],
      },
      after: {
        score: win,
        bestMoveUci: solution,
        lines: [{ multipv: 1, score: win, pvUci: [solution] }],
      },
    },
  ];
  if (wrong) {
    rows.push({
      id: `${puzzle.id}:wrong`,
      fen,
      playedUci: wrong,
      before: {
        score: even,
        bestMoveUci: solution,
        lines: [
          { multipv: 1, score: win, pvUci: [solution] },
          { multipv: 2, score: loss, pvUci: [wrong] },
        ],
      },
      after: {
        score: loss,
        bestMoveUci: solution,
        lines: [{ multipv: 1, score: win, pvUci: [solution] }],
      },
    });
  }
  return rows;
}

function firstWrongMove(fen: string, solutionUci: string): string | null {
  const chess = createChess(fen);
  const legal = chess.moves({ verbose: true });
  const solution = solutionUci.toLowerCase();
  for (const move of legal) {
    const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
    if (uci.toLowerCase() !== solution) return uci;
  }
  return null;
}

function evidence(
  fen: string,
  partial: Pick<AnalysisEvidence, "score" | "bestMoveUci" | "lines">,
): AnalysisEvidence {
  return {
    requestId: "dump",
    gameNodeId: "dump",
    fen,
    sideToMove: fen.split(" ")[1] === "b" ? "b" : "w",
    score: partial.score,
    bestMoveUci: partial.bestMoveUci,
    lines: partial.lines,
  };
}
