export {
  annotationsFromInsight,
  EMPTY_BOARD_ANNOTATIONS,
  type SemanticArrowKind,
  type SemanticBoardAnnotation,
} from "@/domain/teaching/annotations";
export type { FeedbackNotice } from "@/domain/teaching/feedback-notice";
export {
  type BuildHintInput,
  buildHintStep,
  buildInitialHintStep,
  MAX_HINT_LEVEL,
  MIN_HINT_LEVEL,
  nextHintActionLabel,
  nextHintLevel,
} from "@/domain/teaching/hints";
export {
  CONCEPT_PRIORITY,
  chooseConcept,
  selectTeachingInsight,
} from "@/domain/teaching/select-insight";
export {
  classificationLabel,
  hintQuestionForPosition,
  renderExplanation,
  type TemplateContext,
} from "@/domain/teaching/templates";
export type {
  HintLevel,
  HintStep,
  TeachingConcept,
  TeachingInsight,
} from "@/domain/teaching/types";
