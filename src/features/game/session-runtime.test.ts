import { describe, expect, it } from "vitest";
import {
  createExternalStore,
  createStartGate,
} from "@/features/game/session-runtime";

describe("createExternalStore", () => {
  it("notifies subscribers on setState and replace", () => {
    const store = createExternalStore({ n: 1, label: "a" });
    const seen: Array<{ n: number; label: string }> = [];
    const off = store.subscribe(() => {
      seen.push(store.getState());
    });
    store.setState({ n: 2 });
    store.replace({ n: 0, label: "z" });
    off();
    store.setState({ n: 9 });
    expect(seen).toEqual([
      { n: 2, label: "a" },
      { n: 0, label: "z" },
    ]);
  });
});

describe("createStartGate", () => {
  it("reuses an in-flight start and invalidates it on dispose", async () => {
    const gate = createStartGate();
    let runs = 0;
    const first = gate.run(false, async (gen) => {
      runs += 1;
      await Promise.resolve();
      return gate.isCurrent(gen);
    });
    const second = gate.run(false, async () => {
      runs += 1;
      return true;
    });
    expect(second).toBe(first);
    expect(await first).toBe(true);
    expect(runs).toBe(1);

    const disposeGen = gate.beginDispose();
    expect(gate.isDisposeCurrent(disposeGen)).toBe(true);
    expect(gate.disposed).toBe(true);

    const afterDispose = gate.run(false, async (gen) => gate.isCurrent(gen));
    expect(await afterDispose).toBe(true);
    expect(gate.disposed).toBe(false);
  });

  it("skips work when already ready", async () => {
    const gate = createStartGate();
    let runs = 0;
    await gate.run(true, async () => {
      runs += 1;
      return true;
    });
    expect(runs).toBe(0);
  });
});
