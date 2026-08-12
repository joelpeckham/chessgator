export type {
  HintLevel,
  HintStep,
  TeachingConcept,
  TeachingInsight,
} from "@/domain/teaching/types";

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

export {
  MAX_HINT_LEVEL,
  buildHintStep,
  nextHintLevel,
  type BuildHintInput,
} from "@/domain/teaching/hints";
