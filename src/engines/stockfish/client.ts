import type { AnalysisEvidence } from "@/domain/analysis/types";
import {
  disposeEngineClient,
  startEngineHandshake,
} from "@/engines/shared/engine-init";
import {
  type EngineJob,
  EngineJobBook,
} from "@/engines/shared/engine-job-book";
import { stockfishAssetWorkerUrl } from "@/engines/stockfish/assets";
import { type AnalyzeOptions } from "@/engines/stockfish/ports";
import type {
  StockfishWorkerRequest,
  StockfishWorkerResponse,
} from "@/engines/stockfish/protocol";
import { PriorityQueue } from "@/engines/stockfish/queue";
import {
  createDefaultStockfishTransport,
  type StockfishTransport,
} from "@/engines/stockfish/transport";

export type { AnalyzeOptions } from "@/engines/stockfish/ports";

export type StockfishClientOptions = {
  transport?: StockfishTransport;
  /** Override engine asset URL (tests / custom hosting). */
  engineUrl?: string;
  /** Default movetime for analyze(). */
  defaultMovetimeMs?: number;
  /** Extra ms added to movetime for the client-side timeout. */
  timeoutBufferMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

type PendingJob = EngineJob<AnalysisEvidence> & {
  fen: string;
  multipv: number;
  movetimeMs: number;
};

export type StockfishClientStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "disposed"
  | "failed";

/**
 * Promise-based Stockfish façade: one priority queue, cancellation, timeouts,
 * and stale-result filtering by request / game-node id.
 */
export class StockfishClient {
  private readonly transport: StockfishTransport;
  private readonly engineUrl: string;
  private readonly defaultMovetimeMs: number;
  private readonly timeoutBufferMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  private readonly queue = new PriorityQueue<PendingJob>();
  private readonly jobs: EngineJobBook<AnalysisEvidence, PendingJob>;

  private statusValue: StockfishClientStatus = "idle";
  private initPromise: Promise<void> | null = null;
  private unsubscribe: (() => void) | null = null;
  private cancelInitialization: ((error: Error) => void) | null = null;

  constructor(options: StockfishClientOptions = {}) {
    this.transport = options.transport ?? createDefaultStockfishTransport();
    this.engineUrl = options.engineUrl ?? stockfishAssetWorkerUrl();
    this.defaultMovetimeMs = options.defaultMovetimeMs ?? 250;
    this.timeoutBufferMs = options.timeoutBufferMs ?? 1_500;
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
        this.queue.remove(requestId);
      },
      postCancel: (requestId) => {
        this.post({ type: "cancel", requestId });
      },
      afterReleaseActive: () => {
        this.pump();
      },
      cancelMessage: (requestId) => `Analysis cancelled: ${requestId}`,
      timeoutMessage: (job) => `Analysis timed out after ${job.timeoutMs}ms`,
      staleMessage: (gameNodeId, current) =>
        `Stale analysis ignored for node ${gameNodeId} (current ${current})`,
      onUnresponsive: () => {
        this.failWorker("Stockfish worker unresponsive");
      },
    });
  }

  status(): StockfishClientStatus {
    return this.statusValue;
  }

  /** Mark which game node is "current" so stale results are ignored. */
  setCurrentGameNodeId(gameNodeId: string | null): void {
    this.jobs.setCurrentGameNodeId(gameNodeId);
  }

  async initialize(): Promise<void> {
    if (this.statusValue === "ready") return;
    if (this.statusValue === "disposed") {
      throw new Error("StockfishClient is disposed");
    }
    if (this.initPromise) return this.initPromise;

    this.statusValue = "initializing";
    const requestId = `init-${this.jobs.nextGeneration()}`;
    const handshake = startEngineHandshake<StockfishWorkerResponse>({
      subscribe: (listener) => this.transport.subscribe(listener),
      post: () => {
        this.post({ type: "init", requestId, engineUrl: this.engineUrl });
      },
      setTimer: this.setTimer,
      clearTimer: this.clearTimer,
      timeoutMs: 30_000,
      timeoutMessage: "Stockfish init timed out",
      onMessage: (msg, settle) => {
        if (msg.type === "ready" && msg.requestId === requestId) {
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

  analyze(options: AnalyzeOptions): Promise<AnalysisEvidence> {
    if (this.statusValue === "disposed") {
      return Promise.reject(new Error("StockfishClient is disposed"));
    }

    const movetimeMs = options.movetimeMs ?? this.defaultMovetimeMs;
    const timeoutMs = options.timeoutMs ?? movetimeMs + this.timeoutBufferMs;

    return new Promise<AnalysisEvidence>((resolve, reject) => {
      if (this.jobs.pending.has(options.requestId)) {
        reject(new Error(`Duplicate requestId: ${options.requestId}`));
        return;
      }

      const job: PendingJob = {
        requestId: options.requestId,
        gameNodeId: options.gameNodeId,
        fen: options.fen,
        multipv: options.multipv ?? 3,
        movetimeMs,
        timeoutMs,
        resolve,
        reject,
        cancelled: false,
      };

      this.jobs.track(job);
      this.queue.enqueue(job.requestId, options.priority ?? "background", job);
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

  /**
   * Cancel a request. Removes it from the queue or asks the worker to stop
   * if it is currently running. The promise rejects immediately; the worker
   * slot stays busy until `cancelled` / late `result` arrives so searches
   * never overlap on the single-thread engine.
   */
  cancel(requestId: string): void {
    this.jobs.cancel(requestId);
  }

  /** Cancel every pending/active job (e.g. on navigation). */
  cancelAll(): void {
    this.jobs.cancelAll();
  }

  async dispose(): Promise<void> {
    if (this.statusValue === "disposed") return;
    this.statusValue = "disposed";
    this.cancelAll();
    this.cancelInitialization?.(
      new Error(
        "Stockfish initialization cancelled because the client was disposed",
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

  /** Test helper: queue order of request ids. */
  queuedRequestIds(): string[] {
    return this.queue.idsInOrder();
  }

  private post(message: StockfishWorkerRequest): void {
    this.transport.postMessage(message);
  }

  private pump(): void {
    if (this.statusValue !== "ready" || this.jobs.active) return;
    const next = this.queue.dequeue();
    if (!next) return;
    const job = next.payload;
    if (job.cancelled) {
      this.pump();
      return;
    }
    this.jobs.active = job;
    this.post({
      type: "analyze",
      requestId: job.requestId,
      gameNodeId: job.gameNodeId,
      fen: job.fen,
      multipv: job.multipv,
      movetimeMs: job.movetimeMs,
    });
  }

  private onWorkerMessage(msg: StockfishWorkerResponse): void {
    if (msg.type === "result") {
      const job = this.jobs.takeResult(msg.requestId, msg.gameNodeId);
      job?.resolve(msg.evidence);
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
