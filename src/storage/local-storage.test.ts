import { afterEach, describe, expect, it } from "vitest";
import { createLocalStorageGameRepository } from "@/storage/local-storage";

describe("createLocalStorageGameRepository", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  afterEach(() => {
    if (original) {
      Object.defineProperty(globalThis, "localStorage", original);
    } else {
      // oxlint-disable-next-line typescript/no-dynamic-delete
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it("returns a no-op repository when localStorage access throws", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    const repo = createLocalStorageGameRepository();
    expect(await repo.load()).toBeNull();
    await expect(repo.clear()).resolves.toBeUndefined();
  });
});
