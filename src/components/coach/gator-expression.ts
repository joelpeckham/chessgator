import type { MoveClassification } from "@/domain/analysis/classification";

export type GatorExpression =
  | "neutral-happy"
  | "really-happy"
  | "intrigued"
  | "surprised"
  | "afraid";

export type GatorMood = MoveClassification | "idle" | "analyzing" | "hint";

export function gatorExpressionFor(mood: GatorMood): GatorExpression {
  switch (mood) {
    case "analyzing":
    case "hint":
    case "inaccuracy":
      return "intrigued";
    case "best":
    case "excellent":
      return "really-happy";
    case "mistake":
      return "surprised";
    case "blunder":
      return "afraid";
    default:
      return "neutral-happy";
  }
}

export function gatorSrc(expression: GatorExpression): string {
  return `/coach/gator-${expression}.svg`;
}
