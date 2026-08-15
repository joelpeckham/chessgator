import type { TeachingConcept, TeachingInsight } from "@/domain/teaching";
import type { SavedLesson } from "@/storage";

const TEACHING_CONCEPTS: ReadonlySet<TeachingConcept> = new Set([
  "piece_safety",
  "check",
  "capture",
  "threat",
  "development",
  "king_safety",
  "missed_improvement",
  "solid_move",
  "best_move",
]);

export function toSavedLesson(insight: TeachingInsight): SavedLesson {
  return {
    classification: insight.classification,
    concept: insight.concept,
    confidence: insight.confidence,
    explanation: insight.explanation,
    suggestedMoveUci: insight.suggestedMoveUci,
    suggestedMoveSan: insight.suggestedMoveSan,
    lineUci: [...insight.lineUci],
    refutationUci: [...insight.refutationUci],
    quip: insight.quip,
    nudge: insight.nudge,
  };
}

export function fromSavedLesson(saved: SavedLesson): TeachingInsight | null {
  if (!TEACHING_CONCEPTS.has(saved.concept as TeachingConcept)) return null;
  return {
    concept: saved.concept as TeachingConcept,
    confidence: saved.confidence,
    explanation: saved.explanation,
    suggestedMoveUci: saved.suggestedMoveUci,
    suggestedMoveSan: saved.suggestedMoveSan,
    lineUci: [...saved.lineUci],
    refutationUci: [...saved.refutationUci],
    classification: saved.classification,
    quip: saved.quip,
    nudge: saved.nudge,
  };
}

export function lessonsToSaved(
  lessons: Readonly<Record<string, TeachingInsight>>,
): Record<string, SavedLesson> {
  const out: Record<string, SavedLesson> = {};
  for (const [id, insight] of Object.entries(lessons)) {
    out[id] = toSavedLesson(insight);
  }
  return out;
}

export function lessonsFromSaved(
  saved: Readonly<Record<string, SavedLesson>>,
): Record<string, TeachingInsight> {
  const out: Record<string, TeachingInsight> = {};
  for (const [id, lesson] of Object.entries(saved)) {
    const insight = fromSavedLesson(lesson);
    if (insight) out[id] = insight;
  }
  return out;
}
