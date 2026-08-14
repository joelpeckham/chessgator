import type { MoveClassification } from "@/domain/analysis/classification";

export type GatorExpression =
  | "neutral-happy"
  | "sad"
  | "mischievous"
  | "shocked"
  | "angry"
  | "confused"
  | "scared";

export type GatorMood = MoveClassification | "idle" | "analyzing" | "hint";

export function gatorExpressionFor(mood: GatorMood): GatorExpression {
  switch (mood) {
    case "analyzing":
    case "hint":
    case "inaccuracy":
      return "confused";
    case "best":
    case "excellent":
      return "mischievous";
    case "mistake":
      return "shocked";
    case "blunder":
      return "scared";
    default:
      return "neutral-happy";
  }
}

export function gatorSrc(expression: GatorExpression): string {
  return `/coach/gator-${expression}.svg`;
}
