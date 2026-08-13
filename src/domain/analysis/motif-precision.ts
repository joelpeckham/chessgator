import { Chess } from "chess.js";
import { namedUnitAt, oppositeColor } from "@/domain/analysis/board-units";
import {
  detectBackRankVulnerability,
  detectDiscoveredAttacks,
  detectForks,
  detectPins,
  detectSkewers,
  detectTrappedPieces,
} from "@/domain/analysis/motifs";
import { tryApplyMove } from "@/domain/game/rules";

export type LichessTheme =
  | "fork"
  | "pin"
  | "skewer"
  | "discoveredAttack"
  | "backRankMate"
  | "trappedPiece";

export type PuzzleFixture = {
  id: string;
  fen: string;
  /** First move of the Lichess solution, UCI. */
  move: string;
  themes: LichessTheme[];
};

/**
 * Positions tagged with Lichess puzzle-theme names. Kept small and local so
 * CI does not download the full puzzle dump; refresh via
 * `bun scripts/lichess-puzzle-motifs.ts`.
 */
export const LICHESS_MOTIF_FIXTURES: readonly PuzzleFixture[] = [
  {
    id: "fork-knight",
    fen: "4k3/8/8/8/3Q4/n7/8/4K3 b - - 0 1",
    move: "a3c2",
    themes: ["fork"],
  },
  {
    id: "pin-absolute",
    fen: "4k3/4n3/8/8/8/8/8/R6K w - - 0 1",
    move: "a1e1",
    themes: ["pin"],
  },
  {
    id: "pin-relative",
    fen: "k3q3/8/4n3/8/8/8/8/R6K w - - 0 1",
    move: "a1e1",
    themes: ["pin"],
  },
  {
    id: "skewer-king-rook",
    fen: "4r3/8/8/8/8/8/4k3/R6K w - - 0 1",
    move: "a1e1",
    themes: ["skewer"],
  },
  {
    id: "discovered-check",
    fen: "3k4/8/8/8/8/8/3N4/3RK3 w - - 0 1",
    move: "d2e4",
    themes: ["discoveredAttack"],
  },
  {
    id: "back-rank",
    fen: "6k1/5ppp/8/8/8/8/8/R6K w - - 0 1",
    move: "a1a8",
    themes: ["backRankMate"],
  },
  {
    id: "trapped-knight-edge",
    fen: "7n/6P1/8/8/8/8/8/4K2k w - - 0 1",
    move: "g7g8q",
    themes: ["trappedPiece"],
  },
];

export type MotifReport = {
  theme: LichessTheme;
  predicted: number;
  labeled: number;
  truePositive: number;
  precision: number;
  recall: number;
};

function detectedThemes(fen: string, moveUci: string): Set<LichessTheme> {
  const applied = tryApplyMove(fen, moveUci);
  const found = new Set<LichessTheme>();
  if (!applied) return found;
  const before = new Chess(fen);
  const after = new Chess(applied.fenAfter);
  const defender = oppositeColor(applied.move.color);
  const forker = namedUnitAt(after, applied.move.to);
  if (forker && detectForks(after, forker).length > 0) found.add("fork");
  if (detectPins(after, defender, { relative: true }).length > 0) {
    found.add("pin");
  }
  if (detectSkewers(after, defender).length > 0) found.add("skewer");
  if (detectDiscoveredAttacks(before, after, applied.move).length > 0) {
    found.add("discoveredAttack");
  }
  if (detectBackRankVulnerability(after, defender)) {
    found.add("backRankMate");
  }
  if (detectTrappedPieces(after, defender).length > 0) {
    found.add("trappedPiece");
  }
  return found;
}

export function reportMotifPrecision(
  fixtures: readonly PuzzleFixture[] = LICHESS_MOTIF_FIXTURES,
): MotifReport[] {
  const themes: LichessTheme[] = [
    "fork",
    "pin",
    "skewer",
    "discoveredAttack",
    "backRankMate",
    "trappedPiece",
  ];
  return themes.map((theme) => {
    let predicted = 0;
    let labeled = 0;
    let truePositive = 0;
    for (const fixture of fixtures) {
      const detected = detectedThemes(fixture.fen, fixture.move);
      const isLabeled = fixture.themes.includes(theme);
      const isPredicted = detected.has(theme);
      if (isLabeled) labeled += 1;
      if (isPredicted) predicted += 1;
      if (isLabeled && isPredicted) truePositive += 1;
    }
    return {
      theme,
      predicted,
      labeled,
      truePositive,
      precision: predicted === 0 ? 1 : truePositive / predicted,
      recall: labeled === 0 ? 1 : truePositive / labeled,
    };
  });
}

export function formatMotifReport(reports: MotifReport[]): string {
  const header = "theme             prec   rec    tp/lab/pred";
  const lines = reports.map((row) => {
    const prec = row.precision.toFixed(2);
    const rec = row.recall.toFixed(2);
    const counts = `${row.truePositive}/${row.labeled}/${row.predicted}`;
    return `${row.theme.padEnd(18)}${prec}  ${rec}   ${counts}`;
  });
  return [header, ...lines].join("\n");
}
