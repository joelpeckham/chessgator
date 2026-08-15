import { expect, test } from "@playwright/test";

test.describe("Maia3 5M fp16 worker / ONNX", () => {
  test("typed worker initializes and returns a legal move at temperature 0", async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    await page.goto("/game");

    const result = await page.evaluate(async () => {
      const runner = (
        window as unknown as {
          __runMaiaSmoke?: () => Promise<{
            moveUci: string | null;
            candidates: Array<{ moveUci: string; probability: number }>;
            executionProvider: "webgpu" | "wasm" | null;
            value: { loss: number; draw: number; win: number } | null;
          }>;
        }
      ).__runMaiaSmoke;
      if (!runner) throw new Error("smoke harness missing");
      return runner();
    });

    expect(result.executionProvider).toBe("wasm");
    expect(result.moveUci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(
      result.candidates.every((c) =>
        /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(c.moveUci),
      ),
    ).toBe(true);
    expect(
      consoleMessages.filter(
        (text) =>
          text.includes("VerifyEachNodeIsAssignedToAnEp") ||
          text.includes("Concat") ||
          text.includes("WGSL") ||
          text.includes("WebGPU validation"),
      ),
    ).toEqual([]);
  });
});
