import { MAIA_ORT_WASM_PATHS, MAIA3_5M_FP16_ONNX } from "@/engines/maia/assets";
import type {
  MaiaCandidateMove,
  MaiaWorkerRequest,
  MaiaWorkerResponse,
} from "@/engines/maia/protocol";
import {
  createDefaultMaiaTransport,
  type MaiaTransport,
} from "@/engines/maia/transport";
import {
  disposeEngineClient,
  startEngineHandshake,
} from "@/engines/shared/engine-init";
import {
  type EngineJob,
  EngineJobBook,
} from "@/engines/shared/engine-job-book";

export type MaiaInferOptions = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  selfElo?: number;
  oppoElo?: number;
  temperature?: number;
  topP?: number;
  /** Wall-clock timeout including init; defaults to timeoutBufferMs. */
  timeoutMs?: number;
};

export type MaiaInferResult = {
  requestId: string;
  gameNodeId: string;
  moveUci: string;
  candidates: MaiaCandidateMove[];
  value?: { loss: number; draw: number; win: number };
};

export type MaiaClientOptions = {
  transport?: MaiaTransport;
  modelUrl?: string;
  wasmPaths?: string;
  defaultSelfElo?: number;
  defaultOppoElo?: number;
  defaultTemperature?: number;
  defaultTopP?: number;
  timeoutBufferMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type MaiaClientStatus =
  | "idle"
  | "downloading"
  | "initializing"
  | "ready"
  | "failed"
  | "disposed";

type PendingJob = EngineJob<MaiaInferResult> & {
  fen: string;
  selfElo: number;
  oppoElo: number;
  temperature: number;
  topP: number;
};

/**
 * Promise-based Maia façade: init/dispose, timeouts, cancellation, and
 * stale-result filtering by request / game-node id.
 */
export class MaiaClient {
  private readonly transport: MaiaTransport;
  private readonly modelUrl: string;
  private readonly wasmPaths: string;
  private readonly defaultSelfElo: number;
  private readonly defaultOppoElo: number;
  private readonly defaultTemperature: number;
  private readonly defaultTopP: number;
  private readonly timeoutBufferMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  private readonly queue: PendingJob[] = [];
  private readonly jobs: EngineJobBook<MaiaInferResult, PendingJob>;

  private statusValue: MaiaClientStatus = "idle";
  private initPromise: Promise<void> | null = null;
  private unsubscribe: (() => void) | null = null;
  private executionProvider: "webgpu" | "wasm" | null = null;
  private cancelInitialization: ((error: Error) => void) | null = null;

  constructor(options: MaiaClientOptions = {}) {
    this.transport = options.transport ?? createDefaultMaiaTransport();
    this.modelUrl = options.modelUrl ?? MAIA3_5M_FP16_ONNX;
    this.wasmPaths = options.wasmPaths ?? MAIA_ORT_WASM_PATHS;
    this.defaultSelfElo = options.defaultSelfElo ?? 1500;
    this.defaultOppoElo = options.defaultOppoElo ?? 1500;
    this.defaultTemperature = options.defaultTemperature ?? 0;
    this.defaultTopP = options.defaultTopP ?? 1;
    this.timeoutBufferMs = options.timeoutBufferMs ?? 30_000;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      options.clearTimer ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

    this.unsubscribe = this.transport.subscribe((msg) =>
      this.onWorkerMessage(msg),
    );
    this.jobs = new EngineJobBook({
      setTimer: this.setTimer,
      clearTimer: this.clearTimer,
      removeFromQueue: (requestId) => {
        const idx = this.queue.findIndex((j) => j.requestId === requestId);
        if (idx >= 0) this.queue.splice(idx, 1);
      },
      postCancel: (requestId) => {
        this.post({ type: "cancel", requestId });
      },
      afterReleaseActive: () => {
        this.pump();
      },
      cancelMessage: (requestId) => `Inference cancelled: ${requestId}`,
      timeoutMessage: (job) => `Inference timed out after ${job.timeoutMs}ms`,
      staleMessage: (gameNodeId, current) =>
        `Stale inference ignored for node ${gameNodeId} (current ${current})`,
      onUnresponsive: () => {
        this.failWorker("Maia worker unresponsive");
      },
    });
  }

  status(): MaiaClientStatus {
    return this.statusValue;
  }

  getExecutionProvider(): "webgpu" | "wasm" | null {
    return this.executionProvider;
  }

  /** Mark which game node is "current" so stale results are ignored. */
  setCurrentGameNodeId(gameNodeId: string | null): void {
    this.jobs.setCurrentGameNodeId(gameNodeId);
  }

  async initialize(): Promise<void> {
    if (this.statusValue === "ready") return;
    if (this.statusValue === "disposed") {
      throw new Error("MaiaClient is disposed");
    }
    if (this.initPromise) return this.initPromise;

    this.statusValue = "downloading";
    const requestId = `init-${this.jobs.nextGeneration()}`;
    const handshake = startEngineHandshake<MaiaWorkerResponse>({
      subscribe: (listener) => this.transport.subscribe(listener),
      post: () => {
        this.post({
          type: "init",
          requestId,
          modelUrl: this.modelUrl,
          wasmPaths: this.wasmPaths,
        });
      },
      setTimer: this.setTimer,
      clearTimer: this.clearTimer,
      timeoutMs: 120_000,
      timeoutMessage: "Maia init timed out",
      onMessage: (msg, settle) => {
        if (msg.type === "status" && msg.requestId === requestId) {
          if (msg.phase === "downloading") this.statusValue = "downloading";
          if (msg.phase === "initializing") this.statusValue = "initializing";
          return;
        }
        if (msg.type === "ready" && msg.requestId === requestId) {
          this.executionProvider = msg.executionProvider;
          this.statusValue = "ready";
          settle.resolve();
        } else if (msg.type === "error" && msg.requestId === requestId) {
          this.statusValue = "failed";
          settle.fail(new Error(msg.message));
        }
      },
    });
    this.cancelInitialization = handshake.cancel;
    this.initPromise = handshake.promise
      .catch((err: unknown) => {
        if (this.statusValue !== "disposed" && this.statusValue !== "ready") {
          this.statusValue = "failed";
        }
        throw err;
      })
      .finally(() => {
        this.initPromise = null;
        if (this.cancelInitialization === handshake.cancel) {
          this.cancelInitialization = null;
        }
      });

    return this.initPromise;
  }

  infer(options: MaiaInferOptions): Promise<MaiaInferResult> {
    if (this.statusValue === "disposed") {
      return Promise.reject(new Error("MaiaClient is disposed"));
    }

    const timeoutMs = options.timeoutMs ?? this.timeoutBufferMs;

    return new Promise<MaiaInferResult>((resolve, reject) => {
      if (this.jobs.pending.has(options.requestId)) {
        reject(new Error(`Duplicate requestId: ${options.requestId}`));
        return;
      }

      const job: PendingJob = {
        requestId: options.requestId,
        gameNodeId: options.gameNodeId,
        fen: options.fen,
        selfElo: options.selfElo ?? this.defaultSelfElo,
        oppoElo: options.oppoElo ?? this.defaultOppoElo,
        temperature: options.temperature ?? this.defaultTemperature,
        topP: options.topP ?? this.defaultTopP,
        timeoutMs,
        resolve,
        reject,
        cancelled: false,
      };

      this.jobs.track(job);
      this.queue.push(job);
      void this.initialize()
        .then(() => this.pump())
        .catch((err: unknown) => {
          this.jobs.fail(
            job,
            err instanceof Error ? err : new Error(String(err)),
          );
        });
    });
  }

  cancel(requestId: string): void {
    this.jobs.cancel(requestId);
  }

  cancelAll(): void {
    this.jobs.cancelAll();
  }

  async dispose(): Promise<void> {
    if (this.statusValue === "disposed") return;
    this.statusValue = "disposed";
    this.cancelAll();
    this.cancelInitialization?.(
      new Error(
        "Maia initialization cancelled because the client was disposed",
      ),
    );
    const requestId = `dispose-${this.jobs.nextGeneration()}`;
    await disposeEngineClient({
      requestId,
      postDispose: () => {
        this.post({ type: "dispose", requestId });
      },
      subscribe: (listener) =>
        this.transport.subscribe((msg) => {
          listener(msg.type === "disposed" && msg.requestId === requestId);
        }),
      setTimer: this.setTimer,
      clearTimer: this.clearTimer,
      unsubscribe: this.unsubscribe,
      terminate: () => {
        this.transport.terminate();
      },
    });
    this.unsubscribe = null;
  }

  queuedRequestIds(): string[] {
    return this.queue.map((j) => j.requestId);
  }

  private post(message: MaiaWorkerRequest): void {
    this.transport.postMessage(message);
  }

  private pump(): void {
    if (this.statusValue !== "ready" || this.jobs.active) return;
    const next = this.queue.shift();
    if (!next) return;
    if (next.cancelled) {
      this.pump();
      return;
    }
    this.jobs.active = next;
    this.post({
      type: "infer",
      requestId: next.requestId,
      gameNodeId: next.gameNodeId,
      fen: next.fen,
      selfElo: next.selfElo,
      oppoElo: next.oppoElo,
      temperature: next.temperature,
      topP: next.topP,
    });
  }

  private onWorkerMessage(msg: MaiaWorkerResponse): void {
    if (msg.type === "result") {
      const job = this.jobs.takeResult(msg.requestId, msg.gameNodeId);
      job?.resolve({
        requestId: msg.requestId,
        gameNodeId: msg.gameNodeId,
        moveUci: msg.moveUci,
        candidates: msg.candidates,
        value: msg.value,
      });
      return;
    }
    if (msg.type === "cancelled") {
      this.jobs.handleCancelled(msg.requestId);
      return;
    }
    if (msg.type === "error") {
      const handled = this.jobs.handleError(msg.requestId, msg.message);
      if (msg.requestId === "worker") {
        this.failWorker(msg.message);
        return;
      }
      if (
        !handled &&
        this.statusValue !== "ready" &&
        this.statusValue !== "disposed"
      ) {
        this.statusValue = "failed";
      }
    }
  }

  private failWorker(message: string): void {
    if (this.statusValue === "disposed") return;
    this.statusValue = "failed";
    this.cancelInitialization?.(new Error(message));
    this.jobs.cancelAll();
  }
}
