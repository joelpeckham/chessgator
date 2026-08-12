import { describe, expect, it } from "vitest";
import { PriorityQueue } from "@/engines/stockfish/queue";

describe("PriorityQueue", () => {
  it("orders opponent before user before background", () => {
    const q = new PriorityQueue<string>();
    q.enqueue("bg", "background", "bg");
    q.enqueue("user", "user", "user");
    q.enqueue("opp", "opponent", "opp");
    expect(q.idsInOrder()).toEqual(["opp", "user", "bg"]);
    expect(q.dequeue()?.id).toBe("opp");
    expect(q.dequeue()?.id).toBe("user");
    expect(q.dequeue()?.id).toBe("bg");
  });

  it("keeps FIFO order within the same priority", () => {
    const q = new PriorityQueue<number>();
    q.enqueue("a", "user", 1);
    q.enqueue("b", "user", 2);
    q.enqueue("c", "user", 3);
    expect(q.idsInOrder()).toEqual(["a", "b", "c"]);
  });

  it("removes queued jobs by id", () => {
    const q = new PriorityQueue<string>();
    q.enqueue("keep", "user", "k");
    q.enqueue("drop", "opponent", "d");
    expect(q.remove("drop")).toBe(true);
    expect(q.has("drop")).toBe(false);
    expect(q.idsInOrder()).toEqual(["keep"]);
  });
});
