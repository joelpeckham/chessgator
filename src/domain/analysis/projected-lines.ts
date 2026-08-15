import type { EvaluationScore } from "@/domain/analysis/types";
import { legalUciPrefix, tryApplyMove } from "@/domain/game/rules";

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
  kind: "suggested";
  plies: ProjectedPly[];
  score: EvaluationScore | null;
};

/**
 * Build a validated projected line from a UCI sequence. Illegal suffixes
 * are dropped.
 */
export function projectUciLine(args: {
  rootFen: string;
  rootNodeId: string;
  lineUci: readonly string[];
  kind?: "suggested";
  maxPlies?: number;
  score?: EvaluationScore | null;
}): ProjectedLine {
  const maxPlies = args.maxPlies ?? 1;
  const validated = legalUciPrefix(args.rootFen, args.lineUci).slice(
    0,
    maxPlies,
  );
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
    kind: "suggested",
    plies,
    score: args.score ?? null,
  };
}
