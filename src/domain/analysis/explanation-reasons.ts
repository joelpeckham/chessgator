import type { Color, Square } from "chess.js";
import { oppositeColor } from "@/domain/analysis/board-units";
import { scoreToCpWhite } from "@/domain/analysis/classification";
import type {
  LineEvent,
  MoveEffects,
  NamedUnit,
} from "@/domain/analysis/move-effects";
import { pickPrimaryScore } from "@/domain/analysis/score";
import type {
  EvaluationScore,
  PrincipalVariation,
} from "@/domain/analysis/types";
import type { GameMove } from "@/domain/game/types";

export type EvalFrame =
  | "still_winning"
  | "hands_advantage"
  | "still_losing"
  | "holds";

export type MoveMargin = "only" | "clear" | "near_equal";

export type ExplanationReason =
  | {
      kind: "hanging";
      piece: NamedUnit;
      attackers: NamedUnit[];
      seeCp: number;
      defenderCount: number;
    }
  | {
      kind: "ignored_threat";
      piece: NamedUnit;
      attackers: NamedUnit[];
      seeCp: number;
      defenderCount: number;
    }
  | {
      kind: "kicked_by_pawn";
      piece: NamedUnit;
      attackers: NamedUnit[];
    }
  | {
      kind: "kicks_piece";
      piece: NamedUnit;
    }
  | {
      kind: "capture";
      captured: NamedUnit;
      likely: boolean;
      recapture?: boolean;
    }
  | {
      kind: "pin";
      pinned: NamedUnit;
      target: NamedUnit;
      pinner: NamedUnit;
    }
  | {
      kind: "fork";
      targets: NamedUnit[];
    }
  | {
      kind: "skewer";
      front: NamedUnit;
      back: NamedUnit;
    }
  | {
      kind: "discovered_attack";
      revealed: NamedUnit;
      target: NamedUnit;
    }
  | { kind: "discovered_check" }
  | { kind: "trapped"; piece: NamedUnit }
  | { kind: "overload"; defender: NamedUnit; targets: NamedUnit[] }
  | {
      kind: "removed_defender";
      defender: NamedUnit;
      newlyHanging: NamedUnit;
    }
  | { kind: "check" }
  | { kind: "escapes_check" }
  | { kind: "blocks_check" }
  | { kind: "castle"; side: "kingside" | "queenside" }
  | { kind: "king_safer" }
  | { kind: "king_more_exposed" }
  | { kind: "king_activity" }
  | { kind: "back_rank" }
  | { kind: "saves_piece"; piece: NamedUnit; origin?: Square }
  | { kind: "development"; piece: NamedUnit }
  | { kind: "center_control" }
  | {
      kind: "passed_pawn";
      piece: NamedUnit;
      endgame?: boolean;
      created?: boolean;
    }
  | { kind: "promotion"; to: NamedUnit["type"] }
  | { kind: "doubled_pawns" }
  | { kind: "isolated_pawn" }
  | { kind: "backward_pawn" }
  | { kind: "pawn_shield" }
  | { kind: "open_file" }
  | { kind: "semi_open_file" }
  | { kind: "rook_on_seventh" }
  | { kind: "outpost" }
  | { kind: "mobility" }
  | { kind: "allows_mate"; mateIn: number }
  | { kind: "missed_mate"; mateIn: number }
  | { kind: "forces_mate"; mateIn: number }
  | { kind: "refutation_material"; netCp: number }
  | { kind: "only_move" }
  | { kind: "still_winning" }
  | { kind: "hands_advantage" }
  | { kind: "stronger_position" }
  | {
      kind: "wins_material";
      captured: NamedUnit;
      seeCp: number;
      defenderCount: number;
    }
  | { kind: "gambit_offer"; piece: NamedUnit }
  | { kind: "pawn_break" }
  | { kind: "fianchetto" }
  | { kind: "unpin" }
  | { kind: "hits_queen"; piece: NamedUnit }
  | { kind: "zwischenzug" }
  | { kind: "perpetual" };

const TACTIC_KINDS = new Set<ExplanationReason["kind"]>([
  "capture",
  "wins_material",
  "pin",
  "fork",
  "skewer",
  "discovered_attack",
  "discovered_check",
  "removed_defender",
  "check",
  "escapes_check",
  "blocks_check",
  "kicks_piece",
  "hits_queen",
  "castle",
  "saves_piece",
  "passed_pawn",
  "promotion",
  "forces_mate",
  "gambit_offer",
  "zwischenzug",
  "unpin",
  "pawn_break",
]);

const GENERIC_KINDS = new Set<ExplanationReason["kind"]>([
  "center_control",
  "development",
  "stronger_position",
  "still_winning",
  "hands_advantage",
]);

export function reasonSeverity(reason: ExplanationReason): number {
  switch (reason.kind) {
    case "allows_mate":
      return 1000 + Math.max(0, 10 - reason.mateIn);
    case "missed_mate":
      return 990 + Math.max(0, 10 - reason.mateIn);
    case "forces_mate":
      return 980 + Math.max(0, 10 - reason.mateIn);
    case "hanging":
      return 220 + Math.min(400, Math.abs(reason.seeCp) / 2);
    case "ignored_threat":
      return 210 + Math.min(400, Math.abs(reason.seeCp) / 2);
    case "trapped":
      return 200;
    case "refutation_material":
      return 180 + Math.min(300, Math.abs(reason.netCp) / 3);
    case "check":
    case "escapes_check":
    case "blocks_check":
      return 178;
    case "fork":
      return 175;
    case "skewer":
      return 170;
    case "kicks_piece":
    case "hits_queen":
      return 168;
    case "pin":
      if (reason.pinned.type === "p" && reason.target.type === "r") {
        return 48;
      }
      return 165;
    case "discovered_check":
      return 160;
    case "zwischenzug":
      return 158;
    case "discovered_attack":
      return 145;
    case "removed_defender":
      return 140;
    case "wins_material":
      return 138 + Math.min(80, reason.seeCp / 10);
    case "capture":
      return reason.likely ? 120 : 135;
    case "kicked_by_pawn":
      return 168;
    case "overload":
      return 125;
    case "saves_piece":
      return 110;
    case "gambit_offer":
      return 108;
    case "unpin":
      return 105;
    case "back_rank":
    case "king_more_exposed":
      return 100;
    case "castle":
    case "king_safer":
    case "king_activity":
      return 90;
    case "promotion":
      return 85;
    case "pawn_break":
      return 82;
    case "passed_pawn":
      return reason.endgame ? 125 : 80;
    case "perpetual":
      return 78;
    case "fianchetto":
      return 60;
    case "rook_on_seventh":
    case "outpost":
    case "open_file":
      return 55;
    case "semi_open_file":
      return 48;
    case "only_move":
      return 45;
    case "pawn_shield":
      return 42;
    case "doubled_pawns":
    case "isolated_pawn":
    case "backward_pawn":
      return 40;
    case "mobility":
      return 22;
    case "development":
      return 20;
    case "center_control":
      return 15;
    case "still_winning":
    case "hands_advantage":
      return 8;
    case "stronger_position":
      return 1;
  }
}

export function rankReasons(
  reasons: ExplanationReason[],
  limit = 3,
): ExplanationReason[] {
  return dedupeReasons(reasons)
    .toSorted((a, b) => reasonSeverity(b) - reasonSeverity(a))
    .slice(0, limit);
}

function dropGenericReasons(reasons: ExplanationReason[]): ExplanationReason[] {
  return reasons.filter((reason) => !GENERIC_KINDS.has(reason.kind));
}

export function contrastBenefits(
  suggested: ExplanationReason[],
  played: ExplanationReason[],
): ExplanationReason[] {
  const playedKeys = new Set(played.map((reason) => contrastKey(reason)));
  return suggested.filter((reason) => !playedKeys.has(contrastKey(reason)));
}

export function verifyLikelyTactics(
  reasons: ExplanationReason[],
  evalDeltaCp: number,
): ExplanationReason[] {
  if (evalDeltaCp >= 80) return reasons;
  return reasons.filter((reason) => {
    if (reason.kind === "capture" && reason.likely) {
      return evalDeltaCp >= 40;
    }
    return true;
  });
}

export function pickProblemReasons(
  effects: MoveEffects,
  refutationEvents: LineEvent[] = [],
  extras: {
    evalAfter?: EvaluationScore;
    refutationNetCp?: number;
  } = {},
): ExplanationReason[] {
  const reasons: ExplanationReason[] = [];
  const mover = effects.move.color;

  const mateAgainst = mateInFor(extras.evalAfter, oppositeColor(mover));
  if (mateAgainst !== null) {
    reasons.push({ kind: "allows_mate", mateIn: mateAgainst });
  }

  if (effects.movedPieceHanging) {
    reasons.push({
      kind: "hanging",
      piece: effects.movedPieceHanging.piece,
      attackers: effects.movedPieceHanging.attackers,
      seeCp: effects.movedPieceHanging.seeCp,
      defenderCount: effects.movedPieceHanging.defenderCount,
    });
  }
  if (effects.kickedByPawn) {
    reasons.push({
      kind: "kicked_by_pawn",
      piece: effects.kickedByPawn.piece,
      attackers: effects.kickedByPawn.attackers,
    });
  }
  for (const threat of effects.ignoredThreats) {
    reasons.push({
      kind: "ignored_threat",
      piece: threat.piece,
      attackers: threat.attackers,
      seeCp: threat.seeCp,
      defenderCount: threat.defenderCount,
    });
  }
  for (const hanging of effects.newlyHanging) {
    reasons.push({
      kind: "hanging",
      piece: hanging.piece,
      attackers: hanging.attackers,
      seeCp: hanging.seeCp,
      defenderCount: hanging.defenderCount,
    });
  }
  for (const trapped of effects.trapped) {
    reasons.push({ kind: "trapped", piece: trapped });
  }

  const firstReply = refutationEvents[0];
  if (
    firstReply?.captured &&
    firstReply.captured.color === mover &&
    !reasons.some(
      (reason) =>
        (reason.kind === "hanging" ||
          reason.kind === "ignored_threat" ||
          reason.kind === "trapped") &&
        reason.piece.square === firstReply.captured?.square,
    )
  ) {
    reasons.push({
      kind: "hanging",
      piece: firstReply.captured,
      attackers: [
        {
          type: firstReply.move.piece,
          color: firstReply.move.color,
          square: firstReply.move.to,
        },
      ],
      seeCp: 100,
      defenderCount: 0,
    });
  }

  if (
    extras.refutationNetCp !== undefined &&
    extras.refutationNetCp <= -200 &&
    !reasons.some((reason) => reason.kind === "allows_mate")
  ) {
    reasons.push({
      kind: "refutation_material",
      netCp: extras.refutationNetCp,
    });
  }

  if (
    effects.kingMoreExposed ||
    (effects.castlingRightsLost && !effects.castleSide)
  ) {
    reasons.push({ kind: "king_more_exposed" });
  }
  if (effects.backRankVulnerable) {
    reasons.push({ kind: "back_rank" });
  }
  if (effects.structure.doubledPawnsCreated > 0) {
    reasons.push({ kind: "doubled_pawns" });
  }
  if (effects.structure.isolatedPawnsCreated > 0) {
    reasons.push({ kind: "isolated_pawn" });
  }
  if (effects.structure.backwardPawnsCreated > 0) {
    reasons.push({ kind: "backward_pawn" });
  }
  if (effects.structure.pawnShieldDamage > 0 && effects.phase !== "opening") {
    reasons.push({ kind: "pawn_shield" });
  }
  for (const overload of effects.overloaded) {
    reasons.push({
      kind: "overload",
      defender: overload.defender,
      targets: overload.targets,
    });
  }

  return dedupeReasons(reasons);
}

export function pickBenefitReasons(
  effects: MoveEffects,
  lineEvents: LineEvent[] = [],
  comparedTo?: MoveEffects | null,
  opts: { keepGenerics?: boolean } = {},
): ExplanationReason[] {
  const reasons: ExplanationReason[] = [];
  const mover = effects.move.color;
  const movedPiece: NamedUnit = {
    type: effects.move.piece,
    color: mover,
    square: effects.move.to,
  };
  const originPiece: NamedUnit = {
    type: effects.move.piece,
    color: mover,
    square: effects.move.from,
  };

  if (effects.captured) {
    reasons.push({
      kind: "capture",
      captured: effects.captured,
      likely: false,
      recapture: effects.isRecapture,
    });
    const winsNet = effects.isRecapture
      ? effects.capturedSeeCp - effects.previousCapturedCp
      : effects.capturedSeeCp;
    if (winsNet >= 80) {
      reasons.push({
        kind: "wins_material",
        captured: effects.captured,
        seeCp: effects.capturedSeeCp,
        defenderCount: effects.capturedDefenderCount,
      });
    }
  }
  if (effects.removedDefender) {
    reasons.push({
      kind: "removed_defender",
      defender: effects.removedDefender.defender,
      newlyHanging: effects.removedDefender.newlyHanging,
    });
  }
  for (const pin of effects.pinsCreated) {
    reasons.push({
      kind: "pin",
      pinned: pin.pinned,
      target: pin.target,
      pinner: pin.pinner,
    });
  }
  for (const pin of effects.relativePinsCreated) {
    reasons.push({
      kind: "pin",
      pinned: pin.pinned,
      target: pin.target,
      pinner: pin.pinner,
    });
  }
  for (const fork of effects.forksCreated) {
    reasons.push({
      kind: "fork",
      targets: fork.targets,
    });
  }
  for (const skewer of effects.skewersCreated) {
    reasons.push({
      kind: "skewer",
      front: skewer.front,
      back: skewer.back,
    });
  }
  for (const discovered of effects.discoveredAttacks) {
    if (discovered.isCheck) {
      reasons.push({ kind: "discovered_check" });
    } else {
      reasons.push({
        kind: "discovered_attack",
        revealed: discovered.revealed,
        target: discovered.target,
      });
    }
  }
  if (effects.escapedCheck) {
    reasons.push({ kind: "escapes_check" });
  } else if (effects.blockedCheck) {
    reasons.push({ kind: "blocks_check" });
  }
  if (
    effects.gaveCheck &&
    !effects.escapedCheck &&
    !reasons.some(
      (reason) =>
        reason.kind === "discovered_check" ||
        (reason.kind === "fork" &&
          reason.targets.some((target) => target.type === "k")),
    )
  ) {
    reasons.push({ kind: "check" });
  }
  if (effects.kickedEnemy) {
    reasons.push({ kind: "kicks_piece", piece: effects.kickedEnemy });
  }
  if (effects.hitsQueen && effects.hitsQueen.type === "q") {
    reasons.push({ kind: "hits_queen", piece: effects.hitsQueen });
  }
  if (effects.castleSide) {
    reasons.push({ kind: "castle", side: effects.castleSide });
  } else if (effects.kingActivity) {
    reasons.push({ kind: "king_activity" });
  } else if (effects.kingSafer) {
    reasons.push({ kind: "king_safer" });
  }
  if (effects.retreatedToSafety) {
    reasons.push({
      kind: "saves_piece",
      piece: originPiece,
      origin: effects.move.from,
    });
  }
  for (const saved of effects.savedHanging) {
    reasons.push({ kind: "saves_piece", piece: saved });
  }
  for (const overload of effects.opponentOverloaded) {
    reasons.push({
      kind: "overload",
      defender: overload.defender,
      targets: overload.targets,
    });
  }
  if (effects.createdPassedPawn) {
    reasons.push({
      kind: "passed_pawn",
      piece: effects.createdPassedPawn,
      endgame: effects.phase === "endgame",
      created: true,
    });
  } else if (effects.pushedPassedPawn) {
    reasons.push({
      kind: "passed_pawn",
      piece: effects.pushedPassedPawn,
      endgame: effects.phase === "endgame",
      created: false,
    });
  }
  if (effects.move.promotion) {
    reasons.push({ kind: "promotion", to: effects.move.promotion });
  }
  if (effects.gambitOffer) {
    reasons.push({ kind: "gambit_offer", piece: effects.gambitOffer });
  }
  if (effects.pawnBreak) reasons.push({ kind: "pawn_break" });
  if (effects.fianchetto) reasons.push({ kind: "fianchetto" });
  if (effects.unpinned) reasons.push({ kind: "unpin" });
  if (effects.zwischenzug) reasons.push({ kind: "zwischenzug" });
  if (effects.structure.gainedOpenFile) reasons.push({ kind: "open_file" });
  else if (effects.structure.gainedSemiOpenFile) {
    reasons.push({ kind: "semi_open_file" });
  }
  if (effects.structure.rookReachedSeventh) {
    reasons.push({ kind: "rook_on_seventh" });
  }
  if (effects.structure.knightReachedOutpost) {
    reasons.push({ kind: "outpost" });
  }

  const followUp = lineEvents.filter(
    (event) => event.move.color === mover && event.ply === 2,
  );
  for (const event of followUp) {
    if (event.captured && event.capturedSeeCp >= 80) {
      reasons.push({
        kind: "capture",
        captured: event.captured,
        likely: true,
      });
    }
    if (event.promotion && event.move.promotion) {
      reasons.push({ kind: "promotion", to: event.move.promotion });
    }
  }
  const moverChecks = lineEvents.filter(
    (event) => event.move.color === mover && event.gaveCheck && !event.captured,
  );
  if (moverChecks.length >= 2) {
    reasons.push({ kind: "perpetual" });
  }

  const opening = effects.phase === "opening";
  const endgame = effects.phase === "endgame";
  if (effects.developedPiece && opening) {
    reasons.push({ kind: "development", piece: movedPiece });
  }
  if (
    effects.centerControlDelta > 0 &&
    opening &&
    (!comparedTo || effects.centerControlDelta > comparedTo.centerControlDelta)
  ) {
    reasons.push({ kind: "center_control" });
  }
  if (endgame && effects.kingSafer && !effects.castleSide) {
    reasons.push({ kind: "king_safer" });
  }
  if (
    effects.phase !== "opening" &&
    effects.structure.mobilityDelta >= 6 &&
    !reasons.some((reason) => TACTIC_KINDS.has(reason.kind))
  ) {
    reasons.push({ kind: "mobility" });
  }

  const deduped = dropWeakCenterControl(dedupeReasons(reasons));
  if (opts.keepGenerics) return rankReasons(deduped, 3);
  const concrete = dropGenericReasons(deduped);
  return rankReasons(concrete.length > 0 ? concrete : deduped, 3);
}

export function fallbackBenefitReasons(
  effects: MoveEffects,
): ExplanationReason[] {
  if (effects.blockedCheck) return [{ kind: "blocks_check" }];
  if (effects.escapedCheck) return [{ kind: "escapes_check" }];
  if (effects.developedPiece) {
    return [
      {
        kind: "development",
        piece: {
          type: effects.move.piece,
          color: effects.move.color,
          square: effects.move.to,
        },
      },
    ];
  }
  if (effects.gaveCheck) return [{ kind: "check" }];
  if (effects.pawnBreak) return [{ kind: "pawn_break" }];
  if (effects.fianchetto) return [{ kind: "fianchetto" }];
  if (effects.centerControlDelta > 0) return [{ kind: "center_control" }];
  return [{ kind: "stronger_position" }];
}

function dropWeakCenterControl(
  reasons: ExplanationReason[],
): ExplanationReason[] {
  const developmentFloor = 20;
  const stronger = reasons.some(
    (reason) =>
      reason.kind !== "center_control" &&
      reasonSeverity(reason) > developmentFloor,
  );
  if (!stronger) return reasons;
  return reasons.filter((reason) => reason.kind !== "center_control");
}

export function pickMateBenefits(input: {
  evalBefore: EvaluationScore;
  bestLineScore?: EvaluationScore;
  mover: Color;
}): ExplanationReason[] {
  const forced =
    mateInFor(input.bestLineScore ?? input.evalBefore, input.mover) ??
    mateInFor(input.evalBefore, input.mover);
  if (forced !== null) {
    return [{ kind: "forces_mate", mateIn: forced }];
  }
  const missed = mateInFor(input.evalBefore, input.mover);
  if (missed !== null) {
    return [{ kind: "missed_mate", mateIn: missed }];
  }
  return [];
}

export function classifyMoveMargin(
  alternatives: readonly PrincipalVariation[],
  mover: Color,
): MoveMargin | null {
  const first = alternatives[0];
  const second = alternatives[1];
  if (!first || !second) return null;
  const a = scoreToCpWhite(first.score);
  const b = scoreToCpWhite(second.score);
  if (a === null || b === null) return null;
  const gap = mover === "w" ? a - b : b - a;
  if (gap >= 150) return "only";
  if (gap <= 30) return "near_equal";
  return "clear";
}

export function classifyEvalFrame(
  evalBefore: EvaluationScore,
  evalAfter: EvaluationScore,
  mover: Color,
): EvalFrame | null {
  const before = scoreToCpWhite(evalBefore);
  const after = scoreToCpWhite(evalAfter);
  if (before === null || after === null) return null;
  const beforeFor = mover === "w" ? before : -before;
  const afterFor = mover === "w" ? after : -after;
  if (beforeFor >= 150 && afterFor >= 80) return "still_winning";
  if (beforeFor >= 50 && afterFor <= -80) return "hands_advantage";
  if (beforeFor <= -80 && afterFor <= -80) return "still_losing";
  if (Math.abs(beforeFor) < 50 && Math.abs(afterFor) < 50) return "holds";
  return null;
}

export function reasonSquares(reason: ExplanationReason): string[] {
  switch (reason.kind) {
    case "hanging":
    case "ignored_threat":
    case "kicked_by_pawn":
      return [reason.piece.square, ...reason.attackers.map((a) => a.square)];
    case "kicks_piece":
    case "hits_queen":
    case "gambit_offer":
    case "trapped":
    case "saves_piece":
    case "passed_pawn":
    case "development":
      return [reason.piece.square];
    case "capture":
    case "wins_material":
      return [reason.captured.square];
    case "pin":
      return [reason.pinner.square, reason.pinned.square, reason.target.square];
    case "fork":
      return reason.targets.map((t) => t.square);
    case "skewer":
      return [reason.front.square, reason.back.square];
    case "discovered_attack":
      return [reason.revealed.square, reason.target.square];
    case "overload":
      return [reason.defender.square, ...reason.targets.map((t) => t.square)];
    case "removed_defender":
      return [reason.defender.square, reason.newlyHanging.square];
    default:
      return [];
  }
}

function mateInFor(
  score: EvaluationScore | undefined,
  mover: Color,
): number | null {
  if (!score) return null;
  const primary = pickPrimaryScore(score);
  if (primary.mate === undefined) return null;
  if (mover === "w" && primary.mate > 0) return primary.mate;
  if (mover === "b" && primary.mate < 0) return Math.abs(primary.mate);
  return null;
}

function contrastKey(reason: ExplanationReason): string {
  switch (reason.kind) {
    case "capture":
      return `capture:${reason.captured.type}`;
    case "wins_material":
      return `wins_material:${reason.captured.type}`;
    case "pin":
      return `pin:${reason.pinned.type}`;
    case "fork":
      return `fork:${reason.targets.map((t) => t.type).join(",")}`;
    case "kicks_piece":
      return `kicks:${reason.piece.type}`;
    default:
      return reason.kind;
  }
}

function dedupeReasons(reasons: ExplanationReason[]): ExplanationReason[] {
  const seen = new Set<string>();
  const out: ExplanationReason[] = [];
  for (const reason of reasons) {
    const key = reasonKey(reason);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(reason);
  }
  return out;
}

function reasonKey(reason: ExplanationReason): string {
  switch (reason.kind) {
    case "hanging":
    case "ignored_threat":
    case "kicked_by_pawn":
    case "trapped":
      return `${reason.kind}:${reason.piece.square}`;
    case "capture":
      return `capture:${reason.captured.square}:${reason.likely ? "l" : "i"}`;
    case "wins_material":
      return `winsmat:${reason.captured.square}:${reason.seeCp}`;
    case "pin":
      return `pin:${reason.pinned.square}`;
    case "fork":
      return `fork:${reason.targets.map((t) => t.square).join(",")}`;
    case "skewer":
      return `skewer:${reason.front.square}`;
    case "saves_piece":
      return `saves:${reason.piece.square}:${reason.origin ?? ""}`;
    case "kicks_piece":
    case "hits_queen":
    case "gambit_offer":
      return `${reason.kind}:${reason.piece.square}`;
    case "development":
      return `dev:${reason.piece.square}`;
    case "castle":
      return `castle:${reason.side}`;
    case "allows_mate":
    case "missed_mate":
    case "forces_mate":
      return `${reason.kind}:${reason.mateIn}`;
    case "refutation_material":
      return `refmat:${reason.netCp}`;
    case "removed_defender":
      return `rmdef:${reason.newlyHanging.square}`;
    case "discovered_attack":
      return `disc:${reason.target.square}`;
    case "passed_pawn":
      return `passed:${reason.piece.square}`;
    default:
      return reason.kind;
  }
}

export function dropTautologyReasons(
  reasons: ExplanationReason[],
  move: GameMove,
): ExplanationReason[] {
  return reasons.filter((reason) => !restatesMove(reason, move));
}

function restatesMove(reason: ExplanationReason, move: GameMove): boolean {
  switch (reason.kind) {
    case "capture":
      if (reason.recapture) return false;
      return (
        !reason.likely &&
        Boolean(move.captured) &&
        (reason.captured.square === move.to ||
          reason.captured.type === move.captured)
      );
    case "promotion":
      return Boolean(move.promotion) && reason.to === move.promotion;
    case "development":
      return reason.piece.type === move.piece;
    default:
      return false;
  }
}
