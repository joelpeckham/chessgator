import type { Color, PieceSymbol } from "chess.js";
import {
  materialLabel,
  type NamedUnit,
  PIECE_VALUE_CP,
} from "@/domain/analysis/board-units";
import type { ExplanationReason } from "@/domain/analysis/explanation-reasons";
import { castleSideOf, type LineEvent } from "@/domain/analysis/move-effects";
import { createChess } from "@/domain/game";
import type { GameMove } from "@/domain/game/types";
import { PHRASE_BANK, type PhraseBankKey } from "@/domain/teaching/phrase-bank";

const PIECE_NAME: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const COLOR_NAME: Record<Color, string> = {
  w: "white",
  b: "black",
};

export type CopyOptions = {
  fen?: string;
  seed?: string;
};

function pieceName(type: PieceSymbol): string {
  return PIECE_NAME[type];
}

function colorName(color: Color): string {
  return COLOR_NAME[color];
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickVariant(
  variants: readonly string[],
  seed: string | undefined,
  key: string,
): string {
  const first = variants[0];
  if (!first) return "";
  if (!seed || variants.length === 1) return first;
  const index = hashSeed(`${seed}:${key}`) % variants.length;
  return variants[index] ?? first;
}

function bankPhrase(key: PhraseBankKey, seed: string | undefined): string {
  return pickVariant(PHRASE_BANK[key], seed, key);
}

function sameTypeCount(fen: string, unit: NamedUnit): number {
  const chess = createChess(fen);
  let n = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell?.type === unit.type && cell.color === unit.color) n += 1;
    }
  }
  return n;
}

function labeledPiece(unit: NamedUnit, fen: string | undefined): string {
  const name = pieceName(unit.type);
  if (!fen || unit.type === "k" || unit.type === "p") return name;
  if (sameTypeCount(fen, unit) <= 1) return name;
  return `${unit.square}-${name}`;
}

export function describeMove(move: GameMove, opts: CopyOptions = {}): string {
  const castle = castleSideOf(move);
  if (castle === "kingside") return "castling kingside";
  if (castle === "queenside") return "castling queenside";

  const unit: NamedUnit = {
    type: move.piece,
    color: move.color,
    square: move.from,
  };
  const yours = labeledPiece(unit, opts.fen);

  if (move.promotion) {
    return `promoting your pawn to a ${pieceName(move.promotion)} on ${move.to}`;
  }

  if (move.captured) {
    const captured = pieceName(move.captured);
    if (move.piece === "p") {
      return `taking the ${captured} on ${move.to} with your ${fileName(move.from)}-pawn`;
    }
    return `taking the ${captured} on ${move.to} with your ${yours}`;
  }

  if (move.piece === "p") {
    return `moving your pawn to ${move.to}`;
  }
  return `moving your ${yours} to ${move.to}`;
}

export function describePlayedProblem(
  reason: ExplanationReason,
  played: GameMove,
  opts: CopyOptions = {},
): string | null {
  switch (reason.kind) {
    case "hanging": {
      const attacker = attackerPhrase(reason.attackers, opts.fen);
      const piece = ownedPhrase(reason.piece, played.color, opts.fen);
      const loss = hangingLossCopy(reason.seeCp);
      if (reason.piece.square === played.to) {
        if (loss) {
          return attacker
            ? `puts it where ${attacker} can take and you lose ${loss}`
            : `puts it where you lose ${loss} if they take`;
        }
        return attacker
          ? `puts it at risk of attack from ${attacker}`
          : "puts it at risk of attack";
      }
      if (loss) {
        return attacker
          ? `leaves ${piece} where ${attacker} can take, losing ${loss}`
          : `leaves ${piece} hanging, losing ${loss}`;
      }
      return attacker
        ? `leaves ${piece} hanging to ${attacker}`
        : `leaves ${piece} hanging`;
    }
    case "ignored_threat": {
      const attacker = attackerPhrase(reason.attackers, opts.fen);
      return attacker
        ? `leaves ${ownedPhrase(reason.piece, played.color, opts.fen)} hanging to ${attacker}`
        : `leaves ${ownedPhrase(reason.piece, played.color, opts.fen)} hanging`;
    }
    case "kicked_by_pawn":
      return `puts ${ownedPhrase(reason.piece, played.color, opts.fen)} where a pawn can chase it`;
    case "overload":
      return `leaves ${ownedPhrase(reason.defender, played.color, opts.fen)} overloaded`;
    case "backward_pawn":
      return bankPhrase("problem_backward_pawn", opts.seed);
    case "pawn_shield":
      return bankPhrase("problem_pawn_shield", opts.seed);
    case "doubled_pawns":
      return bankPhrase("problem_doubled_pawns", opts.seed);
    case "isolated_pawn":
      return bankPhrase("problem_isolated_pawn", opts.seed);
    case "trapped":
      return `leaves ${ownedPhrase(reason.piece, played.color, opts.fen)} with no safe square`;
    case "allows_mate":
      return `lets ${colorName(played.color === "w" ? "b" : "w")} force checkmate in ${reason.mateIn} ${reason.mateIn === 1 ? "move" : "moves"}`;
    case "king_more_exposed":
      return bankPhrase("problem_king_more_exposed", opts.seed);
    case "back_rank":
      return bankPhrase("problem_back_rank", opts.seed);
    case "refutation_material":
      return `loses ${materialLabel(reason.netCp)} in the coming exchanges`;
    default:
      return null;
  }
}

export function describeConsequence(
  reasons: ExplanationReason[],
  mover: Color,
  opts: CopyOptions = {},
): string | null {
  const mate = reasons.find((reason) => reason.kind === "allows_mate");
  if (mate) {
    const opponent = colorName(mover === "w" ? "b" : "w");
    return `this lets ${opponent} force checkmate in ${mate.mateIn} ${mate.mateIn === 1 ? "move" : "moves"}`;
  }
  const hanging = reasons.find(
    (reason) => reason.kind === "hanging" || reason.kind === "ignored_threat",
  );
  const material = reasons.find(
    (reason) => reason.kind === "refutation_material",
  );
  if (hanging && material) {
    const attacker = attackerPhrase(hanging.attackers, opts.fen);
    const piece = ownedPhrase(hanging.piece, mover, opts.fen);
    if (attacker) {
      return `${attacker} can take ${piece}, leaving you ${materialLabel(material.netCp)} down`;
    }
  }
  return null;
}

export function describeRefutationPunchline(
  events: LineEvent[],
  netCp: number,
  mover: Color,
  opts: CopyOptions = {},
): string | null {
  const first = events[0];
  if (!first?.captured || first.captured.color !== mover) return null;
  const taker = labeledPiece(
    {
      type: first.move.piece,
      color: first.move.color,
      square: first.move.to,
    },
    opts.fen,
  );
  const taken = ownedPhrase(first.captured, mover, opts.fen);
  const down = materialLabel(netCp);
  const second = events[1];
  if (second?.captured && second.move.color === mover) {
    return `after the ${colorName(first.move.color)} ${taker} takes ${taken}, you recapture, leaving you ${down} down`;
  }
  return `after the ${colorName(first.move.color)} ${taker} takes ${taken}, you end up ${down} down`;
}

export function describeBecause(
  reasons: ExplanationReason[],
  mover: Color,
  opts: CopyOptions = {},
): string | null {
  const top = selectBecauseReasons(reasons);
  const first = top[0];
  if (!first) return null;
  const second = top[1];
  if (!second) return describeReason(first, mover, { lead: true, ...opts });
  const sequential = isTacticalAction(first) && isTacticalAction(second);
  return `${describeReason(first, mover, { lead: true, ...opts })} and ${describeReason(
    second,
    mover,
    {
      followUp: sequential,
      another: sequential && sameFocusPiece(first, second),
      lead: !sequential,
      ...opts,
    },
  )}`;
}

function isTacticalAction(reason: ExplanationReason): boolean {
  return (
    reason.kind === "capture" ||
    reason.kind === "pin" ||
    reason.kind === "fork" ||
    reason.kind === "skewer" ||
    reason.kind === "discovered_attack" ||
    reason.kind === "discovered_check" ||
    reason.kind === "removed_defender" ||
    reason.kind === "wins_material"
  );
}

function selectBecauseReasons(
  reasons: ExplanationReason[],
): ExplanationReason[] {
  const withoutCheckIfMate = reasons.some(
    (reason) =>
      reason.kind === "forces_mate" ||
      reason.kind === "allows_mate" ||
      reason.kind === "discovered_check",
  )
    ? reasons.filter((reason) => reason.kind !== "check")
    : reasons;
  const tactical = withoutCheckIfMate.filter((reason) =>
    isTacticalAction(reason),
  );
  if (tactical.length >= 1) return tactical.slice(0, 2);
  const save = withoutCheckIfMate.find(
    (reason) => reason.kind === "saves_piece",
  );
  if (save) return [save];
  return withoutCheckIfMate.slice(0, 2);
}

function describeReason(
  reason: ExplanationReason,
  mover: Color,
  opts: CopyOptions & {
    lead?: boolean;
    followUp?: boolean;
    another?: boolean;
  },
): string {
  const then = opts.followUp ? "then " : "";
  switch (reason.kind) {
    case "hanging":
    case "ignored_threat":
    case "kicked_by_pawn": {
      const attacker = attackerPhrase(reason.attackers, opts.fen);
      if (reason.piece.color === mover) {
        return attacker
          ? `${ownedPhrase(reason.piece, mover, opts.fen)} can be taken by ${attacker}`
          : `${ownedPhrase(reason.piece, mover, opts.fen)} is unsafe`;
      }
      return attacker ? `${attacker} can take it` : "the piece is unsafe";
    }
    case "capture": {
      const name = opts.another
        ? `another ${pieceName(reason.captured.type)}`
        : reason.likely
          ? indefinite(reason.captured.type)
          : `the ${pieceName(reason.captured.type)} on ${reason.captured.square}`;
      if (reason.likely) {
        if (opts.followUp) return `${then}take ${name}`;
        return `you can likely take ${name}`;
      }
      if (opts.followUp) return `${then}take ${name}`;
      return `you take ${name}`;
    }
    case "wins_material": {
      const piece = pieceName(reason.captured.type);
      const pieceValue = PIECE_VALUE_CP[reason.captured.type];
      if (reason.seeCp >= pieceValue - 50) {
        return `the ${piece} was undefended`;
      }
      return `you come out ${materialLabel(reason.seeCp)} ahead`;
    }
    case "pin": {
      const pinned = opts.another
        ? `another ${pieceName(reason.pinned.type)}`
        : `the ${pieceName(reason.pinned.type)}`;
      const target = pieceName(reason.target.type);
      if (reason.likely && opts.lead && !opts.followUp) {
        return `you can likely pin ${pinned} to the ${target}`;
      }
      if (opts.followUp) return `${then}pin ${pinned} to the ${target}`;
      return `you pin ${pinned} to the ${target}`;
    }
    case "fork": {
      const targets = listUnits(reason.targets, mover, opts.fen);
      if (reason.likely && opts.lead && !opts.followUp) {
        return `you can likely fork ${targets}`;
      }
      if (opts.followUp) return `${then}fork ${targets}`;
      return `you fork ${targets}`;
    }
    case "skewer": {
      const front = ownedPhrase(reason.front, mover, opts.fen);
      const back = ownedPhrase(reason.back, mover, opts.fen);
      if (reason.likely) return `you can likely skewer ${front} and ${back}`;
      return `you skewer ${front}, exposing ${back}`;
    }
    case "discovered_attack":
      return `it unveils an attack from your ${pieceName(reason.revealed.type)} on ${ownedPhrase(reason.target, mover, opts.fen)}`;
    case "discovered_check":
      return bankPhrase("discovered_check", opts.seed);
    case "trapped":
      return `${ownedPhrase(reason.piece, mover, opts.fen)} has no safe square`;
    case "overload":
      if (reason.defender.color === mover) {
        return `${ownedPhrase(reason.defender, mover, opts.fen)} is defending too many pieces`;
      }
      return `it overloads ${ownedPhrase(reason.defender, mover, opts.fen)}`;
    case "removed_defender":
      return `you take the defender of ${ownedPhrase(reason.newlyHanging, mover, opts.fen)}`;
    case "check":
      if (opts.followUp) return `${then}put the opponent in check`;
      return bankPhrase("check", opts.seed);
    case "castle":
      return bankPhrase("castle", opts.seed);
    case "king_safer":
      return bankPhrase("king_safer", opts.seed);
    case "king_more_exposed":
      return bankPhrase("king_more_exposed", opts.seed);
    case "back_rank":
      return bankPhrase("back_rank", opts.seed);
    case "saves_piece":
      return `it saves ${ownedPhrase(reason.piece, mover, opts.fen)} from capture`;
    case "development":
      return `it develops your ${pieceName(reason.piece.type)}`;
    case "center_control":
      return bankPhrase("center_control", opts.seed);
    case "passed_pawn":
      return bankPhrase("passed_pawn", opts.seed);
    case "promotion":
      return `you can promote to a ${pieceName(reason.to)}`;
    case "doubled_pawns":
      return bankPhrase("doubled_pawns", opts.seed);
    case "isolated_pawn":
      return bankPhrase("isolated_pawn", opts.seed);
    case "open_file":
      return bankPhrase("open_file", opts.seed);
    case "semi_open_file":
      return bankPhrase("semi_open_file", opts.seed);
    case "rook_on_seventh":
      return bankPhrase("rook_on_seventh", opts.seed);
    case "outpost":
      return bankPhrase("outpost", opts.seed);
    case "backward_pawn":
      return bankPhrase("backward_pawn", opts.seed);
    case "pawn_shield":
      return bankPhrase("pawn_shield", opts.seed);
    case "mobility":
      return bankPhrase("mobility", opts.seed);
    case "allows_mate":
      return `${colorName(mover === "w" ? "b" : "w")} can force checkmate in ${reason.mateIn}`;
    case "missed_mate":
      return `you had a forced mate in ${reason.mateIn}`;
    case "forces_mate":
      return `it forces checkmate in ${reason.mateIn} ${reason.mateIn === 1 ? "move" : "moves"}`;
    case "refutation_material":
      return `you end up ${materialLabel(reason.netCp)} down`;
    case "only_move":
      return bankPhrase("only_move", opts.seed);
    case "still_winning":
      return bankPhrase("still_winning", opts.seed);
    case "hands_advantage":
      return bankPhrase("hands_advantage", opts.seed);
    case "stronger_position":
      return bankPhrase("stronger_position", opts.seed);
  }
}

function hangingLossCopy(seeCp: number): string | null {
  const abs = Math.abs(seeCp);
  if (abs < 150 || abs > 400) return null;
  if (abs >= 180 && abs <= 220) return "the exchange";
  return materialLabel(seeCp);
}

function ownedPhrase(unit: NamedUnit, mover: Color, fen?: string): string {
  const name = labeledPiece(unit, fen);
  if (unit.color === mover) return `your ${name}`;
  return `the ${colorName(unit.color)} ${name}`;
}

function attackerPhrase(attackers: NamedUnit[], fen?: string): string | null {
  const first = attackers[0];
  if (!first) return null;
  const second = attackers[1];
  const firstName = labeledPiece(first, fen);
  if (!second) return `the ${colorName(first.color)} ${firstName}`;
  if (first.color === second.color) {
    return `the ${colorName(first.color)} ${firstName} and ${labeledPiece(second, fen)}`;
  }
  return `the ${colorName(first.color)} ${firstName}`;
}

function indefinite(type: PieceSymbol): string {
  return `a ${pieceName(type)}`;
}

function listUnits(units: NamedUnit[], mover: Color, fen?: string): string {
  const names = units.slice(0, 2).map((unit) => ownedPhrase(unit, mover, fen));
  const first = names[0];
  const second = names[1];
  if (!first) return "two pieces";
  if (!second) return first;
  return `${first} and ${second}`;
}

function fileName(square: string): string {
  return square[0] ?? "";
}

function sameFocusPiece(
  first: ExplanationReason,
  second: ExplanationReason,
): boolean {
  const a = focusType(first);
  const b = focusType(second);
  return Boolean(a && b && a === b);
}

function focusType(reason: ExplanationReason): PieceSymbol | null {
  switch (reason.kind) {
    case "capture":
      return reason.captured.type;
    case "wins_material":
      return reason.captured.type;
    case "pin":
      return reason.pinned.type;
    case "saves_piece":
    case "hanging":
    case "ignored_threat":
    case "kicked_by_pawn":
    case "trapped":
      return reason.piece.type;
    default:
      return null;
  }
}
