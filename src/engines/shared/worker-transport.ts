function errorEventMessage(event: Event): string | undefined {
  if (
    "message" in event &&
    typeof event.message === "string" &&
    event.message
  ) {
    return event.message;
  }
  return undefined;
}

export type WorkerEventType = "message" | "error" | "messageerror";

export type WorkerLike = {
  postMessage(message: unknown): void;
  addEventListener(
    type: WorkerEventType,
    listener: (event: Event) => void,
  ): void;
  removeEventListener(
    type: WorkerEventType,
    listener: (event: Event) => void,
  ): void;
  terminate(): void;
};

export type WorkerTransport<TReq, TRes> = {
  postMessage(message: TReq): void;
  subscribe(listener: (message: TRes) => void): () => void;
  terminate(): void;
};

export function createBrowserWorkerTransport<TReq, TRes>(
  worker: WorkerLike,
  isResponse: (data: unknown) => data is TRes,
): WorkerTransport<TReq, TRes> {
  const listeners = new Set<(message: TRes) => void>();

  const emit = (data: unknown): void => {
    if (!isResponse(data)) return;
    for (const listener of listeners) listener(data);
  };

  const onMessage = (event: Event) => {
    emit((event as MessageEvent<unknown>).data);
  };

  const onFatal = (event: Event) => {
    const message = errorEventMessage(event) ?? "Worker crashed";
    emit({
      type: "error",
      requestId: "worker",
      message,
    });
  };

  worker.addEventListener("message", onMessage);
  worker.addEventListener("error", onFatal);
  worker.addEventListener("messageerror", onFatal);
  return {
    postMessage(message) {
      worker.postMessage(message);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    terminate() {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onFatal);
      worker.removeEventListener("messageerror", onFatal);
      listeners.clear();
      worker.terminate();
    },
  };
}
