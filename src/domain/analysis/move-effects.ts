import { Chess, type Color, type Square } from "chess.js";
import {
  type NamedUnit,
  namedAttackers,
  namedUnitAt,
  oppositeColor,
  PIECE_VALUE_CP,
  rankIndex,
} from "@/domain/analysis/board-units";
import {
  type DiscoveredAttack,
  detectBackRankVulnerability,
  detectDiscoveredAttacks,
  detectForks,
  detectHitsQueen,
  detectOverloadedDefenders,
  detectPassedPawns,
  detectPawnKicks,
  detectPins,
  detectRemovedDefender,
  detectSkewers,
  detectTrappedPieces,
  detectUnpin,
  discoveredAttackIsUsable,
  type ForkFact,
  isFianchetto,
  isPawnBreak,
  type OverloadFact,
  type PinFact,
  type RemovedDefenderFact,
  relativePinIsExploitable,
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
  defenders: NamedUnit[];
  defenderCount: number;
  seeCp: number;
};

export type LineEvent = {
  ply: number;
  move: GameMove;
  captured: NamedUnit | null;
  capturedSeeCp: number;
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
  capturedDefenderCount: number;
  isRecapture: boolean;
  previousCapturedCp: number;
  gaveCheck: boolean;
  developedPiece: boolean;
  kingSafer: boolean;
  kingMoreExposed: boolean;
  escapedCheck: boolean;
  blockedCheck: boolean;
  kingActivity: boolean;
  castlingRightsLost: boolean;
  retreatedToSafety: boolean;
  movedPieceHanging: ThreatenedUnit | null;
  kickedByPawn: ThreatenedUnit | null;
  kickedEnemy: NamedUnit | null;
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
  pushedPassedPawn: NamedUnit | null;
  gambitOffer: NamedUnit | null;
  pawnBreak: boolean;
  fianchetto: boolean;
  unpinned: boolean;
  hitsQueen: NamedUnit | null;
  zwischenzug: boolean;
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
  const defenders = namedAttackers(chess, square, piece.color);
  return [
    {
      piece,
      attackers: namedAttackers(chess, square, attacker),
      defenders,
      defenderCount: defenders.length,
      seeCp: seeGainCp(chess, square, attacker),
    },
  ];
}

function isRecaptureOf(
  move: GameMove,
  previousMove: GameMove | null | undefined,
): boolean {
  if (!move.captured || !previousMove?.captured) return false;
  return move.to === previousMove.to;
}

export function collectMoveEffects(input: {
  fenBefore: string;
  move: GameMove;
  fenAfter: string;
  previousMove?: GameMove | null;
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
  const inCheckBefore = before.isCheck();
  const inCheckAfter = after.isCheck();
  const escapedCheck =
    inCheckBefore && !inCheckAfter && move.piece === "k" && !move.captured;
  const blockedCheck = inCheckBefore && !inCheckAfter && move.piece !== "k";

  const movedPiece = namedUnitAt(after, move.to);
  const movedSee = seeGainCp(after, move.to, opponent);
  const movedDefenders = namedAttackers(after, move.to, mover);
  const movedPieceHanging =
    hangingAfterSet.has(move.to) && movedPiece
      ? {
          piece: movedPiece,
          attackers: namedAttackers(after, move.to, opponent),
          defenders: movedDefenders,
          defenderCount: movedDefenders.length,
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
          defenders: movedDefenders,
          defenderCount: movedDefenders.length,
          seeCp: movedSee,
        }
      : null;

  const kickerUnit: NamedUnit = {
    type: move.piece,
    color: mover,
    square: move.to,
  };
  const pawnKicks = detectPawnKicks(after, kickerUnit);
  const kickedEnemy =
    pawnKicks.find(
      (kick) => kick.target.type === "q" || kick.target.type === "b",
    )?.target ??
    pawnKicks[0]?.target ??
    null;

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
      relativePinIsExploitable(after, pin) &&
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
  const discoveredAttacks = detectDiscoveredAttacks(before, after, move).filter(
    (attack) => discoveredAttackIsUsable(after, attack),
  );

  const passedBefore = new Set(
    detectPassedPawns(before, mover).map((p) => p.square),
  );
  const pushedPassedPawn =
    move.piece === "p" &&
    passedBefore.has(move.from) &&
    detectPassedPawns(after, mover).some((p) => p.square === move.to)
      ? (namedUnitAt(after, move.to) ?? null)
      : null;
  const createdPassedPawn = pushedPassedPawn
    ? null
    : (detectPassedPawns(after, mover).find(
        (p) => !passedBefore.has(p.square),
      ) ?? null);

  const developedPiece =
    move.piece !== "p" &&
    move.piece !== "k" &&
    move.from.endsWith(mover === "w" ? "1" : "8") &&
    !move.to.endsWith(mover === "w" ? "1" : "8");

  const rightsBefore = before.getCastlingRights(mover);
  const rightsAfter = after.getCastlingRights(mover);
  const castlingRightsLost =
    (rightsBefore.k || rightsBefore.q) && !rightsAfter.k && !rightsAfter.q;

  const phase = detectGamePhase(after);
  const moveNumber = Number(fenBefore.split(" ")[5] ?? "1");
  const twoSquarePawn =
    move.piece === "p" &&
    Math.abs(rankIndex(move.from) - rankIndex(move.to)) === 2;
  const gambitOffer =
    phase === "opening" && twoSquarePawn && movedPieceHanging && moveNumber <= 6
      ? movedPieceHanging.piece
      : null;

  const endgameKingWalk =
    phase === "endgame" && move.piece === "k" && !inCheckBefore;
  const kingActivity = endgameKingWalk && exposureAfter >= exposureBefore;
  const kingMoreExposed =
    !endgameKingWalk && !escapedCheck && exposureAfter > exposureBefore;
  const kingSafer =
    !escapedCheck && !blockedCheck && exposureAfter < exposureBefore;

  const recapture = isRecaptureOf(move, input.previousMove);
  const zwischenzug = Boolean(
    input.previousMove?.captured &&
      after.isCheck() &&
      !move.captured &&
      move.to !== input.previousMove.to,
  );

  return {
    move,
    castleSide,
    captured,
    capturedSeeCp: captured ? seeGainCp(before, captured.square, mover) : 0,
    capturedDefenderCount: captured
      ? namedAttackers(before, captured.square, opponent).length
      : 0,
    isRecapture: recapture,
    previousCapturedCp: input.previousMove?.captured
      ? PIECE_VALUE_CP[input.previousMove.captured]
      : 0,
    gaveCheck: after.isCheck(),
    developedPiece,
    kingSafer,
    kingMoreExposed,
    escapedCheck,
    blockedCheck,
    kingActivity,
    castlingRightsLost,
    retreatedToSafety: retreatedToSafety && !escapedCheck,
    movedPieceHanging: gambitOffer ? null : movedPieceHanging,
    kickedByPawn,
    kickedEnemy,
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
    pushedPassedPawn,
    gambitOffer,
    pawnBreak: isPawnBreak(move, after),
    fianchetto: isFianchetto(move),
    unpinned: detectUnpin(before, after, move),
    hitsQueen: detectHitsQueen(before, after, move),
    zwischenzug,
    structure: collectStructureDelta(before, after, mover),
    phase,
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
      capturedSeeCp: captured
        ? seeGainCp(before, captured.square, applied.move.color)
        : 0,
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
