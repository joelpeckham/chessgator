import { describe, expect, it } from "vitest";
import { DEFAULT_POSITION } from "@/domain/game/rules";
import { toVocabUci } from "@/engines/maia/encode";
import type { MaiaWorkerResponse } from "@/engines/maia/protocol";
import { getMoveIndexMap, MOVE_VOCAB_SIZE } from "@/engines/maia/vocabulary";
import { createMaiaWorkerRuntime } from "@/engines/maia/worker-runtime";

function logitsPreferring(fen: string, moveUci: string): Float32Array {
  const logits = new Float32Array(MOVE_VOCAB_SIZE);
  const idx = getMoveIndexMap().get(toVocabUci(fen, moveUci));
  if (idx === undefined) throw new Error(`missing vocab index for ${moveUci}`);
  logits[idx] = 10;
  return logits;
}

function createHarness(options?: {
  loadDelay?: () => Promise<void>;
  runDelay?: () => Promise<void>;
}) {
  const posted: MaiaWorkerResponse[] = [];
  const runtime = createMaiaWorkerRuntime({
    post: (message) => {
      posted.push(message);
    },
    async loadModel(_url, _wasm, report) {
      report("downloading");
      if (options?.loadDelay) await options.loadDelay();
      report("initializing");
      return {
        provider: "wasm",
        async run() {
          if (options?.runDelay) await options.runDelay();
          return {
            logitsMove: logitsPreferring(DEFAULT_POSITION, "e2e4"),
            logitsValue: Float32Array.of(0, 0, 1),
          };
        },
        async release() {},
      };
    },
  });
  return { runtime, posted };
}

describe("createMaiaWorkerRuntime", () => {
  it("reports download/init then ready", async () => {
    const { runtime, posted } = createHarness();
    runtime.handleRequest({
      type: "init",
      requestId: "init-1",
      modelUrl: "/maia.onnx",
      wasmPaths: "/wasm",
    });
    await viWait();
    expect(posted.map((m) => m.type)).toEqual(["status", "status", "ready"]);
    expect(posted.at(-1)).toMatchObject({
      type: "ready",
      requestId: "init-1",
      executionProvider: "wasm",
    });
  });

  it("lets a second init wait on the ready promise", async () => {
    const loadStarted = deferred();
    const { runtime, posted } = createHarness({
      loadDelay: () => loadStarted.promise,
    });
    runtime.handleRequest({
      type: "init",
      requestId: "init-1",
      modelUrl: "/maia.onnx",
      wasmPaths: "/wasm",
    });
    runtime.handleRequest({
      type: "init",
      requestId: "init-2",
      modelUrl: "/maia.onnx",
      wasmPaths: "/wasm",
    });
    loadStarted.resolve();
    await viWait();
    await viWait();
    const readies = posted.filter((m) => m.type === "ready");
    expect(readies.map((m) => m.requestId)).toEqual(["init-1", "init-2"]);
  });

  it("infers a legal move from injected logits", async () => {
    const { runtime, posted } = createHarness();
    runtime.handleRequest({
      type: "init",
      requestId: "init-1",
      modelUrl: "/maia.onnx",
      wasmPaths: "/wasm",
    });
    await viWait();
    runtime.handleRequest({
      type: "infer",
      requestId: "inf-1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
      temperature: 0,
      topP: 1,
    });
    await viWait();
    const result = posted.find((m) => m.type === "result");
    expect(result?.type).toBe("result");
    if (result?.type !== "result") return;
    expect(result.moveUci).toBe("e2e4");
    expect(result.candidates[0]?.moveUci).toBe("e2e4");
  });

  it("cancels an in-flight infer after the model returns", async () => {
    const runStarted = deferred();
    const { runtime, posted } = createHarness({
      runDelay: () => runStarted.promise,
    });
    runtime.handleRequest({
      type: "init",
      requestId: "init-1",
      modelUrl: "/maia.onnx",
      wasmPaths: "/wasm",
    });
    await viWait();
    runtime.handleRequest({
      type: "infer",
      requestId: "inf-1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
      temperature: 0,
      topP: 1,
    });
    runtime.handleRequest({ type: "cancel", requestId: "inf-1" });
    runStarted.resolve();
    await viWait();
    expect(
      posted.some((m) => m.type === "cancelled" && m.requestId === "inf-1"),
    ).toBe(true);
  });

  it("errors when infer runs before init", () => {
    const { runtime, posted } = createHarness();
    runtime.handleRequest({
      type: "infer",
      requestId: "inf-1",
      gameNodeId: "n1",
      fen: DEFAULT_POSITION,
      selfElo: 1500,
      oppoElo: 1500,
      temperature: 0,
      topP: 1,
    });
    expect(posted).toEqual([
      {
        type: "error",
        requestId: "inf-1",
        message: "Maia is not ready",
      },
    ]);
  });
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function viWait(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}
