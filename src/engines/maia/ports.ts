import type { MaiaClientStatus, MaiaInferResult } from "@/engines/maia/client";

/** Minimal MaiaClient surface used by the opponent session (and tests). */
export type MaiaClientLike = {
  status: () => MaiaClientStatus;
  initialize: () => Promise<void>;
  infer: (options: {
    requestId: string;
    gameNodeId: string;
    fen: string;
    selfElo?: number;
    oppoElo?: number;
    temperature?: number;
    topP?: number;
    timeoutMs?: number;
  }) => Promise<Pick<MaiaInferResult, "requestId" | "gameNodeId" | "moveUci">>;
  cancel: (requestId: string) => void;
  dispose: () => Promise<void>;
  setCurrentGameNodeId?: (gameNodeId: string | null) => void;
};
