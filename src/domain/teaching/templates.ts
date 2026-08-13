import type { MoveClassification } from "@/domain/analysis/classification";
import type { TeachingConcept } from "@/domain/teaching/types";

export type TemplateContext = {
  playedPhrase: string;
  suggestedPhrase: string | null;
  playedProblem: string | null;
  playedBecause: string;
  suggestedBecause: string | null;
  classification: MoveClassification;
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
  const played = capitalizePhrase(ctx.playedPhrase);
  const better = betterMoveSentence(ctx);

  let base: string;
  switch (concept) {
    case "best_move":
      base = `${played} is the strongest move because ${ctx.playedBecause}.`;
      break;
    case "solid_move":
      base = `${played} is a solid ${CLASSIFICATION_LABEL[ctx.classification].toLowerCase()} move because ${ctx.playedBecause}.`;
      break;
    case "piece_safety":
    case "threat":
      if (ctx.playedProblem && better) {
        base = `${played} ${ctx.playedProblem}.${better}`;
      } else if (ctx.playedProblem) {
        base = `${played} ${ctx.playedProblem} because ${ctx.playedBecause}.`;
      } else {
        base = `${played} leaves material unsafe because ${ctx.playedBecause}.${better}`;
      }
      break;
    case "check":
      base = `${played} gives check because ${ctx.playedBecause}.${better}`;
      break;
    case "capture":
      base = `${played} wins or trades material because ${ctx.playedBecause}.${better}`;
      break;
    case "development":
      base = `${played} affects development because ${ctx.playedBecause}.${better}`;
      break;
    case "king_safety":
      if (ctx.playedProblem && better) {
        base = `${played} ${ctx.playedProblem}.${better}`;
      } else if (ctx.playedProblem) {
        base = `${played} ${ctx.playedProblem} because ${ctx.playedBecause}.`;
      } else {
        base = `${played} makes your king easier to attack because ${ctx.playedBecause}.${better}`;
      }
      break;
    case "missed_improvement":
      base =
        ctx.suggestedPhrase && ctx.suggestedBecause
          ? `${played} is playable, but ${ctx.suggestedPhrase} would be better because ${ctx.suggestedBecause}.`
          : `${played} is playable because ${ctx.playedBecause}, but there was a clearer improvement.`;
      break;
    default:
      base = `${played} is a ${CLASSIFICATION_LABEL[ctx.classification].toLowerCase()} because ${ctx.playedBecause}.${better}`;
  }

  return collapseSpaces(base);
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

function betterMoveSentence(ctx: TemplateContext): string {
  if (!ctx.suggestedPhrase || !ctx.suggestedBecause) return "";
  return ` A better move would have been ${ctx.suggestedPhrase} because ${ctx.suggestedBecause}.`;
}

function capitalizePhrase(text: string): string {
  if (text.length === 0) return text;
  return text[0]!.toUpperCase() + text.slice(1);
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
}
