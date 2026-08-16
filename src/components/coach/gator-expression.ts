import type { MoveClassification } from "@/domain/analysis/classification";
import type { Color, GameStatus, GameStatusReason } from "@/domain/game";

export type GatorExpression =
  | "neutral-happy"
  | "sad"
  | "mischievous"
  | "shocked"
  | "confused"
  | "scared";

export type GatorMood =
  | MoveClassification
  | "idle"
  | "gameWon"
  | "gameLost"
  | "gameDraw";

export function gatorExpressionFor(mood: GatorMood): GatorExpression {
  switch (mood) {
    case "inaccuracy":
      return "confused";
    case "best":
    case "excellent":
    case "gameWon":
      return "mischievous";
    case "mistake":
      return "shocked";
    case "blunder":
      return "scared";
    case "gameLost":
      return "sad";
    default:
      return "neutral-happy";
  }
}

/** Keep the last reaction face while analysis is in flight with no new mood. */
export function resolveCoachExpression(args: {
  mood: GatorMood;
  analyzing: boolean;
  held: GatorExpression;
}): GatorExpression {
  if (args.analyzing && args.mood === "idle") return args.held;
  return gatorExpressionFor(args.mood);
}

export function gatorSrc(expression: GatorExpression): string {
  return `/coach/gator-${expression}.svg`;
}

export function gameOverMood(args: {
  result: GameStatus["result"];
  terminalReason?: GameStatusReason | null;
  humanColor: Color;
}): GatorMood {
  if (args.terminalReason === "resignation") return "gameLost";
  if (args.result === "draw") return "gameDraw";
  if (args.result === "whiteWins") {
    return args.humanColor === "w" ? "gameWon" : "gameLost";
  }
  if (args.result === "blackWins") {
    return args.humanColor === "b" ? "gameWon" : "gameLost";
  }
  return "gameDraw";
}
