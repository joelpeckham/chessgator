import type {
  LineEvent,
  MoveEffects,
  NamedUnit,
} from "@/domain/analysis/move-effects";

export type ExplanationReason =
  | {
      kind: "hanging";
      piece: NamedUnit;
      attackers: NamedUnit[];
    }
  | {
      kind: "ignored_threat";
      piece: NamedUnit;
      attackers: NamedUnit[];
    }
  | {
      kind: "capture";
      captured: NamedUnit;
      likely: boolean;
    }
  | {
      kind: "pin";
      pinned: NamedUnit;
      target: NamedUnit;
      likely: boolean;
    }
  | {
      kind: "fork";
      targets: NamedUnit[];
      likely: boolean;
    }
  | { kind: "check" }
  | { kind: "castle"; side: "kingside" | "queenside" }
  | { kind: "king_safer" }
  | { kind: "king_more_exposed" }
  | { kind: "saves_piece"; piece: NamedUnit }
  | { kind: "development"; piece: NamedUnit }
  | { kind: "center_control" }
  | { kind: "stronger_position" };

export function pickProblemReasons(
  effects: MoveEffects,
  refutationEvents: LineEvent[] = [],
): ExplanationReason[] {
  const reasons: ExplanationReason[] = [];
  const mover = effects.move.color;

  if (effects.movedPieceHanging) {
    reasons.push({
      kind: "hanging",
      piece: effects.movedPieceHanging.piece,
      attackers: effects.movedPieceHanging.attackers,
    });
  }
  for (const threat of effects.ignoredThreats) {
    reasons.push({
      kind: "ignored_threat",
      piece: threat.piece,
      attackers: threat.attackers,
    });
  }
  for (const hanging of effects.newlyHanging) {
    reasons.push({
      kind: "hanging",
      piece: hanging.piece,
      attackers: hanging.attackers,
    });
  }

  const firstReply = refutationEvents[0];
  if (
    firstReply?.captured &&
    firstReply.captured.color === mover &&
    !reasons.some(
      (reason) =>
        (reason.kind === "hanging" || reason.kind === "ignored_threat") &&
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
    });
  }

  if (
    effects.kingMoreExposed ||
    (effects.castlingRightsLost && !effects.castleSide)
  ) {
    reasons.push({ kind: "king_more_exposed" });
  }

  return dedupeReasons(reasons);
}

export function pickBenefitReasons(
  effects: MoveEffects,
  lineEvents: LineEvent[] = [],
  comparedTo?: MoveEffects | null,
): ExplanationReason[] {
  const reasons: ExplanationReason[] = [];
  const mover = effects.move.color;
  const movedPiece: NamedUnit = {
    type: effects.move.piece,
    color: mover,
    square: effects.move.to,
  };

  if (effects.captured) {
    reasons.push({
      kind: "capture",
      captured: effects.captured,
      likely: false,
    });
  }
  for (const pin of effects.pinsCreated) {
    reasons.push({
      kind: "pin",
      pinned: pin.pinned,
      target: pin.target,
      likely: false,
    });
  }
  for (const fork of effects.forksCreated) {
    reasons.push({
      kind: "fork",
      targets: fork.targets,
      likely: false,
    });
  }
  if (
    effects.gaveCheck &&
    !reasons.some(
      (reason) =>
        reason.kind === "fork" &&
        reason.targets.some((target) => target.type === "k"),
    )
  ) {
    reasons.push({ kind: "check" });
  }
  if (effects.castleSide) {
    reasons.push({ kind: "castle", side: effects.castleSide });
  } else if (effects.kingSafer) {
    reasons.push({ kind: "king_safer" });
  }
  if (effects.retreatedToSafety) {
    reasons.push({ kind: "saves_piece", piece: movedPiece });
  }
  for (const saved of effects.savedHanging) {
    reasons.push({ kind: "saves_piece", piece: saved });
  }

  const later = lineEvents.filter(
    (event) => event.move.color === mover && event.ply > 0,
  );
  for (const event of later) {
    if (event.captured) {
      reasons.push({
        kind: "capture",
        captured: event.captured,
        likely: true,
      });
    }
    for (const pin of event.pins) {
      reasons.push({
        kind: "pin",
        pinned: pin.pinned,
        target: pin.target,
        likely: true,
      });
    }
    for (const fork of event.forks) {
      reasons.push({
        kind: "fork",
        targets: fork.targets,
        likely: true,
      });
    }
    if (event.gaveCheck && !reasons.some((reason) => reason.kind === "check")) {
      reasons.push({ kind: "check" });
    }
  }

  if (effects.developedPiece) {
    reasons.push({ kind: "development", piece: movedPiece });
  }
  if (
    effects.centerControlDelta > 0 &&
    (!comparedTo || effects.centerControlDelta > comparedTo.centerControlDelta)
  ) {
    reasons.push({ kind: "center_control" });
  }

  const unique = dedupeReasons(reasons);
  if (unique.length === 0) {
    return [{ kind: "stronger_position" }];
  }
  return unique.slice(0, 3);
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
      return `${reason.kind}:${reason.piece.square}`;
    case "capture":
      return `capture:${reason.captured.square}:${reason.likely ? "l" : "i"}`;
    case "pin":
      return `pin:${reason.pinned.square}:${reason.likely ? "l" : "i"}`;
    case "fork":
      return `fork:${reason.targets.map((t) => t.square).join(",")}:${reason.likely ? "l" : "i"}`;
    case "saves_piece":
      return `saves:${reason.piece.square}`;
    case "development":
      return `dev:${reason.piece.square}`;
    case "castle":
      return `castle:${reason.side}`;
    default:
      return reason.kind;
  }
}
