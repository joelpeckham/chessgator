import {
  pickPrimaryScore,
  scoreFromSideToMove,
  type SideToMove,
} from "@/domain/analysis/score";
import type {
  EvaluationScore,
  PrincipalVariation,
} from "@/domain/analysis/types";
import { validatePvUci } from "@/engines/stockfish/validate-move";

export type ParsedInfoLine = {
  multipv: number;
  depth?: number;
  seldepth?: number;
  nodes?: number;
  timeMs?: number;
  score?: EvaluationScore;
  /** Raw UCI PV before legal filtering. */
  pvUci: string[];
};

export type ParsedBestMove = {
  bestMoveUci: string | null;
  ponderUci: string | null;
};

const INFO_TOKEN = /^info\b/;
const BESTMOVE_TOKEN = /^bestmove\b/;

/** Parse a UCI `info ...` line. Returns null when the line is not a scorable PV info. */
export function parseInfoLine(line: string): ParsedInfoLine | null {
  const trimmed = line.trim();
  if (!INFO_TOKEN.test(trimmed)) return null;

  const tokens = trimmed.split(/\s+/);
  let multipv = 1;
  let depth: number | undefined;
  let seldepth: number | undefined;
  let nodes: number | undefined;
  let timeMs: number | undefined;
  let score: EvaluationScore | undefined;
  let pvUci: string[] = [];

  for (let i = 1; i < tokens.length; i += 1) {
    const key = tokens[i];
    const next = tokens[i + 1];
    switch (key) {
      case "multipv":
        if (next !== undefined) {
          multipv = Number.parseInt(next, 10) || 1;
          i += 1;
        }
        break;
      case "depth":
        if (next !== undefined) {
          depth = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case "seldepth":
        if (next !== undefined) {
          seldepth = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case "nodes":
        if (next !== undefined) {
          nodes = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case "time":
        if (next !== undefined) {
          timeMs = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case "score": {
        const kind = tokens[i + 1];
        const value = tokens[i + 2];
        if (kind === "cp" && value !== undefined) {
          score = { cp: Number.parseInt(value, 10) };
          i += 2;
        } else if (kind === "mate" && value !== undefined) {
          score = { mate: Number.parseInt(value, 10) };
          i += 2;
        }
        break;
      }
      case "pv":
        pvUci = tokens.slice(i + 1).filter((t) => /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(t));
        i = tokens.length;
        break;
      default:
        break;
    }
  }

  // Currmove / string infos without a score or pv are ignored for MultiPV tables.
  if (!score && pvUci.length === 0) return null;

  return {
    multipv,
    depth,
    seldepth,
    nodes,
    timeMs,
    score,
    pvUci,
  };
}

export function parseBestMove(line: string): ParsedBestMove | null {
  const trimmed = line.trim();
  if (!BESTMOVE_TOKEN.test(trimmed)) return null;
  const tokens = trimmed.split(/\s+/);
  const best = tokens[1];
  if (!best || best === "(none)") {
    return { bestMoveUci: null, ponderUci: null };
  }
  let ponderUci: string | null = null;
  const ponderIdx = tokens.indexOf("ponder");
  if (ponderIdx >= 0 && tokens[ponderIdx + 1]) {
    ponderUci = tokens[ponderIdx + 1]!.toLowerCase();
  }
  return {
    bestMoveUci: best.toLowerCase(),
    ponderUci,
  };
}

/**
 * Merge a parsed info line into a MultiPV table, converting scores to White's perspective.
 */
export function applyInfoLine(
  linesByMultipv: Map<number, PrincipalVariation>,
  info: ParsedInfoLine,
  fen: string,
  sideToMove: SideToMove,
): void {
  const scoreStm = info.score ?? {};
  const scoreWhite = pickPrimaryScore(scoreFromSideToMove(scoreStm, sideToMove));
  const existing = linesByMultipv.get(info.multipv);
  const pvUci = validatePvUci(fen, info.pvUci.length ? info.pvUci : existing?.pvUci ?? []);

  linesByMultipv.set(info.multipv, {
    multipv: info.multipv,
    score: Object.keys(scoreWhite).length ? scoreWhite : existing?.score ?? {},
    pvUci,
    depth: info.depth ?? existing?.depth,
    seldepth: info.seldepth ?? existing?.seldepth,
    nodes: info.nodes ?? existing?.nodes,
    timeMs: info.timeMs ?? existing?.timeMs,
  });
}

export function sortedLines(
  linesByMultipv: Map<number, PrincipalVariation>,
): PrincipalVariation[] {
  return [...linesByMultipv.values()].sort((a, b) => a.multipv - b.multipv);
}

export function sideToMoveFromFen(fen: string): SideToMove {
  const parts = fen.trim().split(/\s+/);
  return parts[1] === "b" ? "b" : "w";
}
