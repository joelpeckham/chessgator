export type WorkerLike = {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
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
  const onMessage = (event: MessageEvent<unknown>) => {
    if (!isResponse(event.data)) return;
    for (const listener of listeners) listener(event.data);
  };
  worker.addEventListener("message", onMessage);
  return {
    postMessage(message) { worker.postMessage(message); },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    terminate() {
      worker.removeEventListener("message", onMessage);
      listeners.clear();
      worker.terminate();
    },
  };
}
