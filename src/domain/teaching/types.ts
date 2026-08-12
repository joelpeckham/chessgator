import type { MoveClassification } from "@/domain/analysis/classification";

/**
 * Teaching concepts for v1. Heuristics are explicit in `select-insight.ts`.
 * No LLM prose — templates only.
 */
export type TeachingConcept =
  | "piece_safety"
  | "check"
  | "capture"
  | "threat"
  | "development"
  | "king_safety"
  | "missed_improvement"
  | "solid_move"
  | "best_move";

export type TeachingInsight = {
  concept: TeachingConcept;
  /** 0–1; higher when engine loss and tactics agree. */
  confidence: number;
  explanation: string;
  suggestedMoveUci: string | null;
  suggestedMoveSan: string | null;
  /** Best-move improvement line from the position before the played move. */
  lineUci: string[];
  /**
   * Engine refutation from the position after a mistake/blunder.
   * Distinct from `lineUci` so Explore / Try instead never replay the mistake.
   */
  refutationUci: string[];
  classification: MoveClassification;
  /** Mistakes/inaccuracies auto-expand in the coach UI. */
  autoExpand: boolean;
};

/** Progressive hint ladder before the player moves. */
export type HintLevel = 0 | 1 | 2 | 3;

export type HintStep = {
  level: HintLevel;
  /** Level 0 — Socratic prompt. */
  question: string;
  /** Level 1 — squares to highlight (pattern + labels, not color-only). */
  highlightSquares: string[];
  /** Level 2 — candidate move in UCI. */
  candidateMoveUci: string | null;
  candidateMoveSan: string | null;
  /** Level 3 — short validated line. */
  lineUci: string[];
};
