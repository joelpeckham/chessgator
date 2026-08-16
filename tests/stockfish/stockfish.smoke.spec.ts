import { expect, test } from "@playwright/test";

test.describe("Stockfish lite-single worker/WASM", () => {
  test("typed worker initializes and returns a legal-looking bestmove", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const runner = (
        window as unknown as {
          __runStockfishSmoke?: () => Promise<{
            bestMoveUci: string | null;
            score: { cp?: number; mate?: number } | null;
            sideToMove: "w" | "b" | null;
          }>;
        }
      ).__runStockfishSmoke;
      if (!runner) throw new Error("smoke harness missing");
      return runner();
    });

    expect(result.sideToMove).toBe("w");
    expect(result.bestMoveUci).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    expect(
      result.score &&
        (result.score.cp !== undefined || result.score.mate !== undefined),
    ).toBe(true);
  });
});
