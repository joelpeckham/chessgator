import type { MoveClassification } from "@/domain/analysis/classification";
import type { TeachingConcept } from "@/domain/teaching/types";

export type TemplateContext = {
  playedSan: string;
  suggestedSan: string | null;
  classification: MoveClassification;
  evalLossCp: number;
};

const CLASSIFICATION_LABEL: Record<MoveClassification, string> = {
  best: "Best",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

export function classificationLabel(
  classification: MoveClassification,
): string {
  return CLASSIFICATION_LABEL[classification];
}

const CLASSIFICATION_QUIP: Record<MoveClassification, string> = {
  best: "That's the one.",
  excellent: "Nice.",
  good: "Solid.",
  inaccuracy: "There's better.",
  mistake: "That was shaky.",
  blunder: "Want to look at that?",
};

export function renderQuip(classification: MoveClassification): string {
  return CLASSIFICATION_QUIP[classification];
}

export function renderExplanation(
  concept: TeachingConcept,
  ctx: TemplateContext,
): string {
  const better = ctx.suggestedSan
    ? ` ${ctx.suggestedSan} keeps more of your advantage.`
    : "";
  const loss =
    ctx.evalLossCp > 0
      ? ` About ${ctx.evalLossCp} centipawns slipped away.`
      : "";

  let base: string;
  switch (concept) {
    case "best_move":
      base = `${ctx.playedSan} matches the engine’s top choice.`;
      break;
    case "solid_move":
      base = `${ctx.playedSan} is a solid ${CLASSIFICATION_LABEL[ctx.classification].toLowerCase()} move.`;
      break;
    case "piece_safety":
      base = `${ctx.playedSan} leaves material unsafe.${better}${loss}`;
      break;
    case "check":
      base = `${ctx.playedSan} gives check — keep asking whether the follow-up is forced or only a tempo.`;
      break;
    case "capture":
      base = `${ctx.playedSan} wins or trades material.${better}`;
      break;
    case "threat":
      base = `${ctx.playedSan} does not answer a live threat to your pieces.${better}${loss}`;
      break;
    case "development":
      base = `${ctx.playedSan} affects development — prefer bringing new pieces into the game when the position is quiet.`;
      break;
    case "king_safety":
      base = `${ctx.playedSan} makes your king easier to attack.${better}${loss}`;
      break;
    case "missed_improvement":
      base = `${ctx.playedSan} is playable, but there was a clearer improvement.${better}${loss}`;
      break;
    default:
      base = `${ctx.playedSan}: ${CLASSIFICATION_LABEL[ctx.classification]}.${better}`;
  }

  return base.trim();
}

export function hintQuestionForPosition(input: {
  hangingSquares: string[];
  bestMoveSan: string | null;
  inCheck: boolean;
}): string {
  if (input.inCheck) {
    return "You are in check — which replies get you out safely?";
  }
  if (input.hangingSquares.length > 0) {
    const sq = input.hangingSquares[0] ?? "";
    return `Something on ${sq} may be unsafe. What is the threat, and how do you answer it?`;
  }
  if (input.bestMoveSan) {
    return "What is the most useful idea here — a threat, a developing move, or a king-safety step?";
  }
  return "What is your plan on this move?";
}
