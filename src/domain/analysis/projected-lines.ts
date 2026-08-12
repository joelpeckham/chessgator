import type { AnalysisEvidence, EvaluationScore } from "@/domain/analysis/types";
import { legalUciPrefix, tryApplyMove, uciToSan } from "@/domain/game/rules";

/** Default plies shown as the "future" continuation on the timeline. */
export const FUTURE_PROJECTION_PLIES = 5;

export type ProjectedPly = {
  /** Stable id relative to the projection root: `uci0/uci1/...` */
  pathKey: string;
  uci: string;
  san: string;
  fen: string;
  plyOffset: number;
  score: EvaluationScore | null;
};

export type ProjectedLine = {
  rootFen: string;
  rootNodeId: string;
  kind: "future" | "tutor";
  plies: ProjectedPly[];
  score: EvaluationScore | null;
};

/**
 * Build a validated projected line from a UCI sequence (tutor alternate or
 * best-play future). Illegal suffixes are dropped.
 */
export function projectUciLine(args: {
  rootFen: string;
  rootNodeId: string;
  lineUci: readonly string[];
  kind: "future" | "tutor";
  maxPlies?: number;
  score?: EvaluationScore | null;
}): ProjectedLine {
  const maxPlies = args.maxPlies ?? FUTURE_PROJECTION_PLIES;
  const validated = legalUciPrefix(args.rootFen, args.lineUci).slice(0, maxPlies);
  const plies: ProjectedPly[] = [];
  let fen = args.rootFen;
  const path: string[] = [];

  for (const uci of validated) {
    const applied = tryApplyMove(fen, uci);
    if (!applied) break;
    path.push(applied.move.uci);
    fen = applied.fenAfter;
    plies.push({
      pathKey: path.join("/"),
      uci: applied.move.uci,
      san: applied.move.san,
      fen,
      plyOffset: plies.length + 1,
      score: args.score ?? null,
    });
  }

  return {
    rootFen: args.rootFen,
    rootNodeId: args.rootNodeId,
    kind: args.kind,
    plies,
    score: args.score ?? null,
  };
}

/**
 * Prefer MultiPV line 1 (best) as the future continuation from a position
 * analysis. Returns null when there is no legal PV prefix.
 */
export function projectBestFuture(
  evidence: AnalysisEvidence,
  options?: { maxPlies?: number },
): ProjectedLine | null {
  const best =
    evidence.lines.find((line) => line.multipv === 1) ?? evidence.lines[0];
  const pv = best?.pvUci ?? (evidence.bestMoveUci ? [evidence.bestMoveUci] : []);
  if (pv.length === 0) return null;

  const line = projectUciLine({
    rootFen: evidence.fen,
    rootNodeId: evidence.gameNodeId,
    lineUci: pv,
    kind: "future",
    maxPlies: options?.maxPlies ?? FUTURE_PROJECTION_PLIES,
    score: best?.score ?? evidence.score,
  });
  return line.plies.length > 0 ? line : null;
}

/** Resolve SAN for a UCI move when available; falls back to UCI. */
export function sanOrUci(fen: string, uci: string): string {
  return uciToSan(fen, uci) ?? uci;
}
