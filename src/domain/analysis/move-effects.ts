import { Chess, type Color, type Square } from "chess.js";
import {
  type NamedUnit,
  namedAttackers,
  namedUnitAt,
  oppositeColor,
  PIECE_VALUE_CP,
} from "@/domain/analysis/board-units";
import {
  type DiscoveredAttack,
  detectBackRankVulnerability,
  detectDiscoveredAttacks,
  detectForks,
  detectOverloadedDefenders,
  detectPassedPawns,
  detectPins,
  detectRemovedDefender,
  detectSkewers,
  detectTrappedPieces,
  type ForkFact,
  type OverloadFact,
  type PinFact,
  type RemovedDefenderFact,
  type SkewerFact,
} from "@/domain/analysis/motifs";
import { cheapestAttacker, seeGainCp } from "@/domain/analysis/see";
import {
  collectStructureDelta,
  detectGamePhase,
  type GamePhase,
  type StructureDelta,
} from "@/domain/analysis/structure";
import { hangingSquaresFor, kingExposure } from "@/domain/analysis/tactics";
import { createChess } from "@/domain/game";
import { tryApplyMove } from "@/domain/game/rules";
import type { GameMove } from "@/domain/game/types";

export type { NamedUnit } from "@/domain/analysis/board-units";
export type { ForkFact, PinFact } from "@/domain/analysis/motifs";
export { detectForks, detectPins, namedAttackers, namedUnitAt };

export type CastleSide = "kingside" | "queenside";

export type ThreatenedUnit = {
  piece: NamedUnit;
  attackers: NamedUnit[];
  seeCp: number;
};

export type LineEvent = {
  ply: number;
  move: GameMove;
  captured: NamedUnit | null;
  gaveCheck: boolean;
  pins: PinFact[];
  forks: ForkFact[];
  skewers: SkewerFact[];
  discovered: DiscoveredAttack[];
  promotion: boolean;
};

export type LineSummary = {
  events: LineEvent[];
  netMaterialCp: number;
  forcing: boolean;
};

export type MoveEffects = {
  move: GameMove;
  castleSide: CastleSide | null;
  captured: NamedUnit | null;
  capturedSeeCp: number;
  gaveCheck: boolean;
  developedPiece: boolean;
  kingSafer: boolean;
  kingMoreExposed: boolean;
  castlingRightsLost: boolean;
  retreatedToSafety: boolean;
  movedPieceHanging: ThreatenedUnit | null;
  kickedByPawn: ThreatenedUnit | null;
  newlyHanging: ThreatenedUnit[];
  ignoredThreats: ThreatenedUnit[];
  savedHanging: NamedUnit[];
  pinsCreated: PinFact[];
  relativePinsCreated: PinFact[];
  forksCreated: ForkFact[];
  skewersCreated: SkewerFact[];
  discoveredAttacks: DiscoveredAttack[];
  trapped: NamedUnit[];
  overloaded: OverloadFact[];
  opponentOverloaded: OverloadFact[];
  removedDefender: RemovedDefenderFact | null;
  backRankVulnerable: boolean;
  createdPassedPawn: NamedUnit | null;
  structure: StructureDelta;
  phase: GamePhase;
  centerControlDelta: number;
};

const CENTER_SQUARES: readonly Square[] = ["d4", "e4", "d5", "e5"];

export function castleSideOf(move: GameMove): CastleSide | null {
  if (move.piece !== "k") return null;
  const fromFile = move.from.charCodeAt(0);
  const toFile = move.to.charCodeAt(0);
  if (toFile - fromFile === 2) return "kingside";
  if (fromFile - toFile === 2) return "queenside";
  return null;
}

function capturedUnit(before: Chess, move: GameMove): NamedUnit | null {
  if (!move.captured) return null;
  const opponent = oppositeColor(move.color);
  if (
    move.piece === "p" &&
    move.from[0] !== move.to[0] &&
    !before.get(move.to)
  ) {
    const file = move.to[0] ?? "a";
    const rank = move.from[1] ?? "1";
    const square = `${file}${rank}` as Square;
    return { type: "p", color: opponent, square };
  }
  return { type: move.captured, color: opponent, square: move.to };
}

function centerControlScore(chess: Chess, color: Color): number {
  let score = 0;
  for (const square of CENTER_SQUARES) {
    const occ = chess.get(square);
    if (occ?.color === color) score += 2;
    if (chess.isAttacked(square, color)) score += 1;
  }
  return score;
}

function threatenedAt(
  chess: Chess,
  square: Square,
  attacker: Color,
): ThreatenedUnit[] {
  const piece = namedUnitAt(chess, square);
  if (!piece) return [];
  return [
    {
      piece,
      attackers: namedAttackers(chess, square, attacker),
      seeCp: seeGainCp(chess, square, attacker),
    },
  ];
}

export function collectMoveEffects(input: {
  fenBefore: string;
  move: GameMove;
  fenAfter: string;
}): MoveEffects {
  const { fenBefore, move, fenAfter } = input;
  const before = createChess(fenBefore);
  const after = createChess(fenAfter);
  const mover = move.color;
  const opponent = oppositeColor(mover);

  const hangingBefore = hangingSquaresFor(before, mover) as Square[];
  const hangingAfter = hangingSquaresFor(after, mover) as Square[];
  const hangingBeforeSet = new Set(hangingBefore);
  const hangingAfterSet = new Set(hangingAfter);

  const captured = capturedUnit(before, move);
  const castleSide = castleSideOf(move);
  const exposureBefore = kingExposure(before, mover);
  const exposureAfter = kingExposure(after, mover);

  const movedPiece = namedUnitAt(after, move.to);
  const movedSee = seeGainCp(after, move.to, opponent);
  const movedPieceHanging =
    hangingAfterSet.has(move.to) && movedPiece
      ? {
          piece: movedPiece,
          attackers: namedAttackers(after, move.to, opponent),
          seeCp: movedSee,
        }
      : null;

  const pawnKicker =
    movedPiece && !movedPieceHanging
      ? cheapestAttacker(after, move.to, opponent)
      : null;
  const kickedByPawn =
    movedPiece && pawnKicker?.type === "p" && movedPiece.type !== "p"
      ? {
          piece: movedPiece,
          attackers: [pawnKicker],
          seeCp: movedSee,
        }
      : null;

  const newlyHanging = hangingAfter
    .filter((sq) => sq !== move.to && !hangingBeforeSet.has(sq))
    .flatMap((sq) => threatenedAt(after, sq, opponent));

  const ignoredThreats = hangingBefore
    .filter((sq) => sq !== move.from && hangingAfterSet.has(sq))
    .flatMap((sq) => threatenedAt(after, sq, opponent));

  const savedHanging = hangingBefore
    .filter((sq) => sq !== move.from && !hangingAfterSet.has(sq))
    .flatMap((sq) => {
      const unit = namedUnitAt(after, sq) ?? namedUnitAt(before, sq);
      return unit ? [unit] : [];
    });

  const retreatedToSafety =
    hangingBeforeSet.has(move.from) && !hangingAfterSet.has(move.to);

  const opponentPinsBefore = detectPins(before, opponent);
  const opponentPinsAfter = detectPins(after, opponent, { relative: true });
  const pinsCreated = opponentPinsAfter.filter(
    (pin) =>
      pin.absolute &&
      pin.pinner.square === move.to &&
      !opponentPinsBefore.some(
        (old) =>
          old.pinned.square === pin.pinned.square &&
          old.pinner.square === pin.pinner.square,
      ),
  );
  const relativePinsCreated = opponentPinsAfter.filter(
    (pin) =>
      !pin.absolute &&
      pin.pinner.square === move.to &&
      !opponentPinsBefore.some(
        (old) =>
          old.pinned.square === pin.pinned.square &&
          old.pinner.square === pin.pinner.square,
      ),
  );

  const skewersBefore = detectSkewers(before, opponent);
  const skewersAfter = detectSkewers(after, opponent);
  const skewersCreated = skewersAfter.filter(
    (skewer) =>
      skewer.skewer.square === move.to &&
      !skewersBefore.some(
        (old) =>
          old.front.square === skewer.front.square &&
          old.back.square === skewer.back.square,
      ),
  );

  const forker = movedPiece ?? {
    type: move.piece,
    color: mover,
    square: move.to,
  };
  const forksCreated = detectForks(after, forker);
  const discoveredAttacks = detectDiscoveredAttacks(before, after, move);

  const passedBefore = new Set(
    detectPassedPawns(before, mover).map((p) => p.square),
  );
  const createdPassedPawn =
    detectPassedPawns(after, mover).find((p) => !passedBefore.has(p.square)) ??
    null;

  const developedPiece =
    move.piece !== "p" &&
    move.piece !== "k" &&
    move.from.endsWith(mover === "w" ? "1" : "8") &&
    !move.to.endsWith(mover === "w" ? "1" : "8");

  const rightsBefore = before.getCastlingRights(mover);
  const rightsAfter = after.getCastlingRights(mover);
  const castlingRightsLost =
    (rightsBefore.k || rightsBefore.q) && !rightsAfter.k && !rightsAfter.q;

  return {
    move,
    castleSide,
    captured,
    capturedSeeCp: captured ? seeGainCp(before, captured.square, mover) : 0,
    gaveCheck: after.isCheck(),
    developedPiece,
    kingSafer: exposureAfter < exposureBefore,
    kingMoreExposed: exposureAfter > exposureBefore,
    castlingRightsLost,
    retreatedToSafety,
    movedPieceHanging,
    kickedByPawn,
    newlyHanging,
    ignoredThreats,
    savedHanging,
    pinsCreated,
    relativePinsCreated,
    forksCreated,
    skewersCreated,
    discoveredAttacks,
    trapped: detectTrappedPieces(after, mover),
    overloaded: detectOverloadedDefenders(after, mover),
    opponentOverloaded: detectOverloadedDefenders(after, oppositeColor(mover)),
    removedDefender: detectRemovedDefender(before, after, move),
    backRankVulnerable:
      detectBackRankVulnerability(after, mover) &&
      !detectBackRankVulnerability(before, mover),
    createdPassedPawn,
    structure: collectStructureDelta(before, after, mover),
    phase: detectGamePhase(after),
    centerControlDelta:
      centerControlScore(after, mover) - centerControlScore(before, mover),
  };
}

const DEFAULT_LINE_PLIES = 4;
const FORCING_LINE_PLIES = 8;

export function walkLineEvents(
  fen: string,
  pvUci: readonly string[],
  maxPlies = DEFAULT_LINE_PLIES,
  opts: { extendForcing?: boolean } = {},
): LineEvent[] {
  return summarizeLine(fen, pvUci, maxPlies, opts).events;
}

export function summarizeLine(
  fen: string,
  pvUci: readonly string[],
  maxPlies = DEFAULT_LINE_PLIES,
  opts: { extendForcing?: boolean } = {},
): LineSummary {
  const cap = opts.extendForcing ? FORCING_LINE_PLIES : maxPlies;
  const events: LineEvent[] = [];
  let cursor = fen;
  let netMaterialCp = 0;
  let forcing = true;
  const moverColor = fen.split(" ")[1] === "b" ? "b" : "w";

  for (let ply = 0; ply < pvUci.length && ply < cap; ply += 1) {
    const uci = pvUci[ply];
    if (!uci) break;
    const applied = tryApplyMove(cursor, uci);
    if (!applied) break;
    const before = createChess(cursor);
    const after = createChess(applied.fenAfter);
    const opponent = oppositeColor(applied.move.color);
    const pinsBefore = detectPins(before, opponent);
    const pinsAfter = detectPins(after, opponent, { relative: true });
    const forker: NamedUnit = {
      type: applied.move.piece,
      color: applied.move.color,
      square: applied.move.to,
    };
    const captured = capturedUnit(before, applied.move);
    const isCapture = Boolean(captured);
    const gaveCheck = after.isCheck();
    if (ply >= maxPlies && !(isCapture || gaveCheck)) break;
    if (!(isCapture || gaveCheck || applied.move.promotion)) forcing = false;

    if (captured) {
      const sign = applied.move.color === moverColor ? 1 : -1;
      netMaterialCp += sign * PIECE_VALUE_CP[captured.type];
    }

    events.push({
      ply,
      move: applied.move,
      captured,
      gaveCheck,
      pins: pinsAfter.filter(
        (pin) =>
          pin.pinner.square === applied.move.to &&
          !pinsBefore.some(
            (old) =>
              old.pinned.square === pin.pinned.square &&
              old.pinner.square === pin.pinner.square,
          ),
      ),
      forks: detectForks(after, forker),
      skewers: detectSkewers(after, opponent).filter(
        (skewer) => skewer.skewer.square === applied.move.to,
      ),
      discovered: detectDiscoveredAttacks(before, after, applied.move),
      promotion: Boolean(applied.move.promotion),
    });
    cursor = applied.fenAfter;
  }

  return { events, netMaterialCp, forcing: forcing && events.length > 0 };
}
