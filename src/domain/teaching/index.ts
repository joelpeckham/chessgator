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
  MAX_HINT_LEVEL,
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
  renderQuip,
  type TemplateContext,
} from "@/domain/teaching/templates";
export type {
  HintLevel,
  HintStep,
  TeachingConcept,
  TeachingInsight,
} from "@/domain/teaching/types";
