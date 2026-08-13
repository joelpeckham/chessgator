import type { Color, PieceSymbol } from "chess.js";
import type { ExplanationReason } from "@/domain/analysis/explanation-reasons";
import { castleSideOf, type NamedUnit } from "@/domain/analysis/move-effects";
import type { GameMove } from "@/domain/game/types";

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

function pieceName(type: PieceSymbol): string {
  return PIECE_NAME[type];
}

function colorName(color: Color): string {
  return COLOR_NAME[color];
}

export function describeMove(move: GameMove): string {
  const castle = castleSideOf(move);
  if (castle === "kingside") return "castling kingside";
  if (castle === "queenside") return "castling queenside";

  if (move.promotion) {
    return `promoting your pawn to a ${pieceName(move.promotion)} on ${move.to}`;
  }

  if (move.captured) {
    const captured = pieceName(move.captured);
    if (move.piece === "p") {
      return `taking the ${captured} on ${move.to} with your ${fileName(move.from)}-pawn`;
    }
    return `taking the ${captured} on ${move.to} with your ${pieceName(move.piece)}`;
  }

  if (move.piece === "p") {
    return `moving your pawn to ${move.to}`;
  }
  return `moving your ${pieceName(move.piece)} to ${move.to}`;
}

export function describePlayedProblem(
  reason: ExplanationReason,
  played: GameMove,
): string | null {
  switch (reason.kind) {
    case "hanging": {
      const attacker = attackerPhrase(reason.attackers);
      if (reason.piece.square === played.to) {
        return attacker
          ? `puts it at risk of attack from ${attacker}`
          : "puts it at risk of attack";
      }
      return attacker
        ? `leaves ${ownedPhrase(reason.piece, played.color)} hanging to ${attacker}`
        : `leaves ${ownedPhrase(reason.piece, played.color)} hanging`;
    }
    case "ignored_threat": {
      const attacker = attackerPhrase(reason.attackers);
      return attacker
        ? `leaves ${ownedPhrase(reason.piece, played.color)} hanging to ${attacker}`
        : `leaves ${ownedPhrase(reason.piece, played.color)} hanging`;
    }
    case "king_more_exposed":
      return "makes your king easier to attack";
    default:
      return null;
  }
}

export function describeBecause(
  reasons: ExplanationReason[],
  mover: Color,
): string {
  const top = selectBecauseReasons(reasons);
  const first = top[0];
  if (!first) return "it keeps a stronger position";
  const second = top[1];
  if (!second) return describeReason(first, mover, { lead: true });
  const sequential = isTacticalAction(first) && isTacticalAction(second);
  return `${describeReason(first, mover, { lead: true })} and ${describeReason(
    second,
    mover,
    {
      followUp: sequential,
      another: sequential && sameFocusPiece(first, second),
      lead: !sequential,
    },
  )}`;
}

function isTacticalAction(reason: ExplanationReason): boolean {
  return (
    reason.kind === "capture" || reason.kind === "pin" || reason.kind === "fork"
  );
}

function selectBecauseReasons(
  reasons: ExplanationReason[],
): ExplanationReason[] {
  const tactical = reasons.filter((reason) => isTacticalAction(reason));
  if (tactical.length >= 2) return tactical.slice(0, 2);
  const save = reasons.find((reason) => reason.kind === "saves_piece");
  if (save) return [save];
  return reasons.slice(0, 2);
}

function describeReason(
  reason: ExplanationReason,
  mover: Color,
  opts: { lead?: boolean; followUp?: boolean; another?: boolean },
): string {
  const then = opts.followUp ? "then " : "";
  switch (reason.kind) {
    case "hanging":
    case "ignored_threat": {
      const attacker = attackerPhrase(reason.attackers);
      if (reason.piece.color === mover) {
        return attacker
          ? `${ownedPhrase(reason.piece, mover)} can be taken by ${attacker}`
          : `${ownedPhrase(reason.piece, mover)} is unsafe`;
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
      const targets = listUnits(reason.targets, mover);
      if (reason.likely && opts.lead && !opts.followUp) {
        return `you can likely fork ${targets}`;
      }
      if (opts.followUp) return `${then}fork ${targets}`;
      return `you fork ${targets}`;
    }
    case "check":
      if (opts.followUp) return `${then}put the opponent in check`;
      return "it puts the opponent in check";
    case "castle":
      return "it gets your king out of danger and activates your rook";
    case "king_safer":
      return "it keeps your king safer";
    case "king_more_exposed":
      return "your king is more open to attack";
    case "saves_piece":
      return `it saves ${ownedPhrase(reason.piece, mover)} from capture`;
    case "development":
      return `it develops your ${pieceName(reason.piece.type)}`;
    case "center_control":
      return "you control more central squares";
    case "stronger_position":
      return "it keeps a stronger position";
  }
}

function ownedPhrase(unit: NamedUnit, mover: Color): string {
  if (unit.color === mover) return `your ${pieceName(unit.type)}`;
  return `the ${colorName(unit.color)} ${pieceName(unit.type)}`;
}

function attackerPhrase(attackers: NamedUnit[]): string | null {
  const first = attackers[0];
  if (!first) return null;
  const second = attackers[1];
  if (!second) return `the ${colorName(first.color)} ${pieceName(first.type)}`;
  if (first.color === second.color) {
    return `the ${colorName(first.color)} ${pieceName(first.type)} and ${pieceName(second.type)}`;
  }
  return `the ${colorName(first.color)} ${pieceName(first.type)}`;
}

function indefinite(type: PieceSymbol): string {
  return `a ${pieceName(type)}`;
}

function listUnits(units: NamedUnit[], mover: Color): string {
  const names = units.slice(0, 2).map((unit) => ownedPhrase(unit, mover));
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
    case "pin":
      return reason.pinned.type;
    case "saves_piece":
    case "hanging":
    case "ignored_threat":
      return reason.piece.type;
    default:
      return null;
  }
}
