import {
  MAIA3_5M_FP16_ONNX,
  MAIA_ORT_WASM_PATHS,
} from "@/engines/maia/assets";
import type {
  MaiaCandidateMove,
  MaiaWorkerRequest,
  MaiaWorkerResponse,
} from "@/engines/maia/protocol";
import {
  createDefaultMaiaTransport,
  type MaiaTransport,
} from "@/engines/maia/transport";

export type MaiaInferOptions = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  historyFens?: string[];
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

type PendingJob = {
  requestId: string;
  gameNodeId: string;
  fen: string;
  historyFens?: string[];
  selfElo: number;
  oppoElo: number;
  temperature: number;
  topP: number;
  timeoutMs: number;
  resolve: (result: MaiaInferResult) => void;
  reject: (error: Error) => void;
  cancelled: boolean;
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

  private readonly pending = new Map<string, PendingJob>();
  private readonly queue: PendingJob[] = [];
  private readonly timeoutHandles = new Map<string, unknown>();

  private statusValue: MaiaClientStatus = "idle";
  private initPromise: Promise<void> | null = null;
  private unsubscribe: (() => void) | null = null;
  private active: PendingJob | null = null;
  private currentGameNodeId: string | null = null;
  private generation = 0;
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
    this.setTimer =
      options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer =
      options.clearTimer ??
      ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

    this.unsubscribe = this.transport.subscribe((msg) => this.onWorkerMessage(msg));
  }

  status(): MaiaClientStatus {
    return this.statusValue;
  }

  getExecutionProvider(): "webgpu" | "wasm" | null {
    return this.executionProvider;
  }

  /** Mark which game node is "current" so stale results are ignored. */
  setCurrentGameNodeId(gameNodeId: string | null): void {
    this.currentGameNodeId = gameNodeId;
  }

  async initialize(): Promise<void> {
    if (this.statusValue === "ready") return;
    if (this.statusValue === "disposed") {
      throw new Error("MaiaClient is disposed");
    }
    if (this.initPromise) return this.initPromise;

    this.statusValue = "downloading";
    this.initPromise = new Promise<void>((resolve, reject) => {
      const requestId = `init-${this.generation++}`;
      const resources: {
        timer?: unknown;
        unsubscribe: (() => void) | null;
      } = { unsubscribe: null };
      let settled = false;

      const cleanup = (): boolean => {
        if (settled) return false;
        settled = true;
        if (resources.timer !== undefined) {
          this.clearTimer(resources.timer);
        }
        resources.unsubscribe?.();
        if (this.cancelInitialization === cancel) {
          this.cancelInitialization = null;
        }
        return true;
      };
      const cancel = (error: Error): void => {
        if (!cleanup()) return;
        reject(error);
      };
      const fail = (error: Error): void => {
        if (!cleanup()) return;
        this.statusValue = "failed";
        reject(error);
      };

      resources.unsubscribe = this.transport.subscribe((msg) => {
        if (msg.type === "status" && msg.requestId === requestId) {
          if (msg.phase === "downloading") this.statusValue = "downloading";
          if (msg.phase === "initializing") this.statusValue = "initializing";
          return;
        }
        if (msg.type === "ready" && msg.requestId === requestId) {
          if (!cleanup()) return;
          this.executionProvider = msg.executionProvider;
          this.statusValue = "ready";
          resolve();
        } else if (msg.type === "error" && msg.requestId === requestId) {
          fail(new Error(msg.message));
        }
      });

      this.cancelInitialization = cancel;
      resources.timer = this.setTimer(
        () => fail(new Error("Maia init timed out")),
        120_000,
      );

      try {
        this.post({
          type: "init",
          requestId,
          modelUrl: this.modelUrl,
          wasmPaths: this.wasmPaths,
        });
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    }).finally(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  infer(options: MaiaInferOptions): Promise<MaiaInferResult> {
    if (this.statusValue === "disposed") {
      return Promise.reject(new Error("MaiaClient is disposed"));
    }

    const timeoutMs = options.timeoutMs ?? this.timeoutBufferMs;

    return new Promise<MaiaInferResult>((resolve, reject) => {
      if (this.pending.has(options.requestId)) {
        reject(new Error(`Duplicate requestId: ${options.requestId}`));
        return;
      }

      const job: PendingJob = {
        requestId: options.requestId,
        gameNodeId: options.gameNodeId,
        fen: options.fen,
        historyFens: options.historyFens,
        selfElo: options.selfElo ?? this.defaultSelfElo,
        oppoElo: options.oppoElo ?? this.defaultOppoElo,
        temperature: options.temperature ?? this.defaultTemperature,
        topP: options.topP ?? this.defaultTopP,
        timeoutMs,
        resolve,
        reject,
        cancelled: false,
      };

      this.pending.set(job.requestId, job);
      this.queue.push(job);
      this.armTimeout(job);
      void this.initialize()
        .then(() => this.pump())
        .catch((err: unknown) => {
          this.failJob(job, err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  cancel(requestId: string): void {
    const job = this.pending.get(requestId);
    if (!job || job.cancelled) return;
    job.cancelled = true;
    this.removeFromQueue(requestId);

    const isActive = this.active?.requestId === requestId;
    if (isActive) {
      this.post({ type: "cancel", requestId });
    }

    this.failJob(job, new Error(`Inference cancelled: ${requestId}`), {
      releaseActive: !isActive,
    });
  }

  cancelAll(): void {
    for (const id of [...this.pending.keys()]) {
      this.cancel(id);
    }
  }

  async dispose(): Promise<void> {
    if (this.statusValue === "disposed") return;
    this.statusValue = "disposed";
    this.cancelAll();
    this.cancelInitialization?.(
      new Error("Maia initialization cancelled because the client was disposed"),
    );
    const requestId = `dispose-${this.generation++}`;
    await new Promise<void>((resolve) => {
      const timer = this.setTimer(() => resolve(), 1_000);
      const off = this.transport.subscribe((msg) => {
        if (msg.type === "disposed" && msg.requestId === requestId) {
          this.clearTimer(timer);
          off();
          resolve();
        }
      });
      this.post({ type: "dispose", requestId });
    });
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.transport.terminate();
    this.statusValue = "disposed";
  }

  queuedRequestIds(): string[] {
    return this.queue.map((j) => j.requestId);
  }

  private post(message: MaiaWorkerRequest): void {
    this.transport.postMessage(message);
  }

  private removeFromQueue(requestId: string): void {
    const idx = this.queue.findIndex((j) => j.requestId === requestId);
    if (idx >= 0) this.queue.splice(idx, 1);
  }

  private pump(): void {
    if (this.statusValue !== "ready" || this.active) return;
    const next = this.queue.shift();
    if (!next) return;
    if (next.cancelled) {
      this.pump();
      return;
    }
    this.active = next;
    this.post({
      type: "infer",
      requestId: next.requestId,
      gameNodeId: next.gameNodeId,
      fen: next.fen,
      historyFens: next.historyFens,
      selfElo: next.selfElo,
      oppoElo: next.oppoElo,
      temperature: next.temperature,
      topP: next.topP,
    });
  }

  private onWorkerMessage(msg: MaiaWorkerResponse): void {
    if (msg.type === "result") {
      this.onResult(msg);
      return;
    }
    if (msg.type === "cancelled") {
      const job = this.pending.get(msg.requestId);
      if (job) {
        this.failJob(job, new Error(`Inference cancelled: ${msg.requestId}`));
      } else {
        this.releaseActive(msg.requestId);
      }
      return;
    }
    if (msg.type === "error") {
      const job = this.pending.get(msg.requestId);
      if (job) {
        this.failJob(job, new Error(msg.message));
      } else if (this.statusValue !== "ready" && this.statusValue !== "disposed") {
        this.statusValue = "failed";
      } else {
        this.releaseActive(msg.requestId);
      }
    }
  }

  private onResult(msg: Extract<MaiaWorkerResponse, { type: "result" }>): void {
    const job = this.pending.get(msg.requestId);

    if (!job) {
      this.releaseActive(msg.requestId);
      return;
    }

    if (job.cancelled) {
      this.failJob(job, new Error(`Inference cancelled: ${msg.requestId}`));
      return;
    }

    if (
      this.currentGameNodeId !== null &&
      msg.gameNodeId !== this.currentGameNodeId
    ) {
      this.failJob(
        job,
        new Error(
          `Stale inference ignored for node ${msg.gameNodeId} (current ${this.currentGameNodeId})`,
        ),
      );
      return;
    }

    this.clearTimeout(msg.requestId);
    this.pending.delete(msg.requestId);
    this.releaseActive(msg.requestId);
    job.resolve({
      requestId: msg.requestId,
      gameNodeId: msg.gameNodeId,
      moveUci: msg.moveUci,
      candidates: msg.candidates,
      value: msg.value,
    });
  }

  private armTimeout(job: PendingJob): void {
    const handle = this.setTimer(() => {
      if (!this.pending.has(job.requestId) || job.cancelled) return;
      job.cancelled = true;
      this.removeFromQueue(job.requestId);
      const isActive = this.active?.requestId === job.requestId;
      if (isActive) {
        this.post({ type: "cancel", requestId: job.requestId });
      }
      this.failJob(
        job,
        new Error(`Inference timed out after ${job.timeoutMs}ms`),
        { releaseActive: !isActive },
      );
    }, job.timeoutMs);
    this.timeoutHandles.set(job.requestId, handle);
  }

  private clearTimeout(requestId: string): void {
    const handle = this.timeoutHandles.get(requestId);
    if (handle !== undefined) {
      this.clearTimer(handle);
      this.timeoutHandles.delete(requestId);
    }
  }

  private releaseActive(requestId: string): void {
    if (this.active?.requestId === requestId) {
      this.active = null;
      this.pump();
    }
  }

  private failJob(
    job: PendingJob,
    error: Error,
    options: { releaseActive?: boolean } = {},
  ): void {
    const releaseActive = options.releaseActive ?? true;
    if (!this.pending.has(job.requestId)) {
      if (releaseActive) this.releaseActive(job.requestId);
      return;
    }
    this.clearTimeout(job.requestId);
    this.pending.delete(job.requestId);
    job.reject(error);
    if (releaseActive) {
      this.releaseActive(job.requestId);
    }
  }
}
