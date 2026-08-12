export type { MoveClassification } from "@/domain/analysis/classification";
export {
  AUTO_EXPAND_CLASSIFICATIONS,
  CLASSIFICATION_THRESHOLDS,
  classifyEvalLoss,
  classifyPlayedMove,
  evalLossForMover,
  scoreToCpWhite,
  shouldAutoExpand,
} from "@/domain/analysis/classification";
export type {
  BuildMoveAnalysisInput,
  MoveAnalysisEvidence,
} from "@/domain/analysis/move-analysis";
export {
  buildMoveAnalysisEvidence,
  SHORT_PV_MAX_PLIES,
} from "@/domain/analysis/move-analysis";
export type {
  ProjectedLine,
  ProjectedPly,
} from "@/domain/analysis/projected-lines";
export {
  FUTURE_PROJECTION_PLIES,
  projectBestFuture,
  projectUciLine,
  sanOrUci,
} from "@/domain/analysis/projected-lines";
export type { SideToMove } from "@/domain/analysis/score";
export {
  negateScore,
  pickPrimaryScore,
  scoreFromSideToMove,
  scoreToSideToMove,
} from "@/domain/analysis/score";
export type {
  TacticalFacts,
  TacticalFactsInput,
} from "@/domain/analysis/tactics";
export {
  collectTacticalFacts,
  hangingSquaresFor,
  isHangingOn,
  kingExposure,
  opponentCaptureTargets,
  PIECE_VALUE_CP,
} from "@/domain/analysis/tactics";
export type {
  AnalysisEvidence,
  AnalysisPriority,
  EvaluationScore,
  PrincipalVariation,
} from "@/domain/analysis/types";
export { ANALYSIS_PRIORITY_RANK } from "@/domain/analysis/types";
