import { describe, expect, it } from "vitest";
import {
  createBrowserWorkerTransport,
  type WorkerLike,
} from "@/engines/shared/worker-transport";

type TestResponse =
  | { type: "ready"; requestId: string }
  | { type: "error"; requestId: string; message: string };

function isTestResponse(value: unknown): value is TestResponse {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return type === "ready" || type === "error";
}

function createFakeWorker(): WorkerLike & {
  emit: (type: "message" | "error" | "messageerror", event: Event) => void;
} {
  const listeners = new Map<string, Set<(event: Event) => void>>();
  return {
    postMessage() {},
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    terminate() {},
    emit(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

describe("createBrowserWorkerTransport", () => {
  it("broadcasts a fatal error when the worker crashes", () => {
    const worker = createFakeWorker();
    const transport = createBrowserWorkerTransport(worker, isTestResponse);
    const received: TestResponse[] = [];
    transport.subscribe((msg) => {
      received.push(msg);
    });

    worker.emit(
      "error",
      Object.assign(new Event("error"), { message: "module failed" }),
    );

    expect(received).toEqual([
      { type: "error", requestId: "worker", message: "module failed" },
    ]);
  });
});
