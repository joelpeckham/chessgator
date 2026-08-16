import {
  isTeachable,
  type MoveClassification,
} from "@/domain/analysis/classification";
import type {
  EvalFrame,
  MoveMargin,
} from "@/domain/analysis/explanation-reasons";
import type { TeachingConcept } from "@/domain/teaching/types";

export type TemplateContext = {
  playedPhrase: string;
  suggestedPhrase: string | null;
  problem: string | null;
  consequence: string | null;
  playedBecause: string | null;
  suggestedBecause: string | null;
  classification: MoveClassification;
  concept: TeachingConcept;
  evalFrame: EvalFrame | null;
  margin: MoveMargin | null;
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

export function renderExplanation(ctx: TemplateContext): string {
  const played = capitalizePhrase(ctx.playedPhrase);
  const parts: string[] = [];

  if (ctx.problem) {
    const lead = evalLead(ctx);
    if (lead) {
      parts.push(`${lead}, but ${lowerFirst(played)} ${ctx.problem}.`);
    } else {
      parts.push(`${played} ${ctx.problem}.`);
    }
    if (
      ctx.consequence &&
      !containsIgnoreCase(ctx.problem, ctx.consequence) &&
      !sameMateLesson(ctx.problem, ctx.consequence)
    ) {
      parts.push(`${capitalizePhrase(ctx.consequence)}.`);
    }
    const better = betterMoveSentence(ctx);
    if (better) parts.push(better.trim());
  } else if (ctx.concept === "missed_improvement") {
    parts.push(missedImprovementSentence(played, ctx));
  } else {
    parts.push(verdictSentence(played, ctx));
    const better = betterMoveSentence(ctx);
    if (better) parts.push(better.trim());
  }

  return collapseSpaces(parts.join(" "));
}

export function hintQuestionForPosition(input: {
  hangingSquares: string[];
  bestMoveSan: string | null;
  inCheck: boolean;
  question?: string;
}): string {
  if (input.question) return input.question;
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

const VERDICT_BY_CLASSIFICATION: Record<MoveClassification, string> = {
  best: "is the strongest move",
  excellent: "is an excellent move",
  good: "is a good move",
  inaccuracy: "is an inaccuracy",
  mistake: "is a mistake",
  blunder: "is a blunder",
};

function verdictClause(ctx: TemplateContext): string {
  if (
    ctx.margin === "only" &&
    (ctx.classification === "best" || ctx.concept === "best_move")
  ) {
    return "is the only move that holds";
  }
  if (ctx.concept === "best_move") {
    if (!ctx.playedBecause) {
      return "is the engine's choice here";
    }
    if (ctx.margin === "near_equal") {
      return "is one of several strong moves";
    }
    if (ctx.margin === "clear") {
      return "is clearly the strongest move";
    }
    return "is the strongest move";
  }
  if (ctx.concept === "solid_move") {
    return `is a solid ${CLASSIFICATION_LABEL[ctx.classification].toLowerCase()} move`;
  }
  const teachable = isTeachable(ctx.classification);
  if (!teachable && ctx.evalFrame === "still_winning") {
    return "keeps you winning";
  }
  if (ctx.evalFrame === "hands_advantage") {
    return "hands the opponent the advantage";
  }
  if (teachable && ctx.evalFrame === "still_losing") {
    return "doesn't ease a difficult position";
  }
  if (teachable && ctx.evalFrame === "holds") {
    return "keeps the position even";
  }
  return VERDICT_BY_CLASSIFICATION[ctx.classification];
}

function verdictSentence(played: string, ctx: TemplateContext): string {
  const verdict = verdictClause(ctx);
  if (ctx.playedBecause) {
    return `${played} ${verdict} because ${ctx.playedBecause}.`;
  }
  return `${played} ${verdict}.`;
}

function missedImprovementSentence(
  played: string,
  ctx: TemplateContext,
): string {
  const mild =
    ctx.classification === "inaccuracy" ||
    ctx.classification === "good" ||
    ctx.classification === "excellent";
  const lead = mild
    ? `${played} is playable`
    : `${played} ${VERDICT_BY_CLASSIFICATION[ctx.classification]}`;
  if (ctx.suggestedPhrase && ctx.suggestedBecause) {
    return `${lead}, but ${ctx.suggestedPhrase} would be better because ${ctx.suggestedBecause}.`;
  }
  if (ctx.playedBecause) {
    return mild
      ? `${played} is playable because ${ctx.playedBecause}, but there was a clearer improvement.`
      : `${lead} because ${ctx.playedBecause}.`;
  }
  return mild
    ? `${played} is playable, but there was a clearer improvement.`
    : `${lead}.`;
}

function evalLead(ctx: TemplateContext): string | null {
  if (ctx.evalFrame === "still_winning") return "You are still winning";
  if (ctx.evalFrame === "still_losing") return "You are still worse";
  if (ctx.evalFrame === "holds") return "The position stays even";
  return null;
}

function betterMoveSentence(ctx: TemplateContext): string {
  if (!ctx.suggestedPhrase || ctx.concept === "best_move") return "";
  if (!ctx.suggestedBecause) return "";
  return ` A better move would have been ${ctx.suggestedPhrase} because ${ctx.suggestedBecause}.`;
}

function capitalizePhrase(text: string): string {
  if (text.length === 0) return text;
  return text[0]!.toUpperCase() + text.slice(1);
}

function lowerFirst(text: string): string {
  if (text.length === 0) return text;
  return text[0]!.toLowerCase() + text.slice(1);
}

function containsIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase().slice(0, 24));
}

function sameMateLesson(problem: string, consequence: string): boolean {
  const mate = /checkmate|mate in \d/i;
  return mate.test(problem) && mate.test(consequence);
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
}
