import type {
  AnalysisEvidence,
  AnalysisPriority,
} from "@/domain/analysis/types";

export type AnalyzeOptions = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  priority?: AnalysisPriority;
  multipv?: number;
  movetimeMs?: number;
  /** Wall-clock timeout including queue wait; defaults to movetime + buffer. */
  timeoutMs?: number;
};

/** Minimal StockfishClient surface used by coaching (and e2e stubs). */
export type StockfishClientLike = {
  status: () => string;
  initialize: () => Promise<void>;
  analyze: (options: AnalyzeOptions) => Promise<AnalysisEvidence>;
  cancel: (requestId: string) => void;
  cancelAll: () => void;
  setCurrentGameNodeId: (gameNodeId: string | null) => void;
  dispose: () => Promise<void>;
};

export type CreateAnalysisEngineFn = () => StockfishClientLike;
