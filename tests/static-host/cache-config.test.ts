import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const REQUIRE_OUT = process.env.REQUIRE_STATIC_OUT === "1";

describe("static host cache configuration", () => {
  it("ships Vercel + Netlify cache rules for versioned assets", () => {
    const vercelPath = path.join(ROOT, "vercel.json");
    const headersPath = path.join(ROOT, "public/_headers");
    expect(existsSync(vercelPath)).toBe(true);
    expect(existsSync(headersPath)).toBe(true);

    const vercel = JSON.parse(readFileSync(vercelPath, "utf8")) as {
      headers: Array<{ source: string; headers: Array<{ value: string }> }>;
    };
    const sources = vercel.headers.map((h) => h.source);
    expect(sources.some((s) => s.includes("/engine/"))).toBe(true);
    expect(sources.some((s) => s.includes("/models/"))).toBe(true);
    expect(sources.some((s) => s.includes("/ort/1.27.0/"))).toBe(true);
    expect(sources.some((s) => s.includes("/_next/static/"))).toBe(true);

    const immutable = vercel.headers.filter((h) =>
      h.headers.some((entry) => entry.value.includes("immutable")),
    );
    expect(immutable.length).toBeGreaterThanOrEqual(3);

    const netlify = readFileSync(headersPath, "utf8");
    expect(netlify).toMatch(/\/engine\/\*/);
    expect(netlify).toMatch(/\/ort\/1\.27\.0\/\*/);
    expect(netlify).toMatch(/max-age=31536000,\s*immutable/);
  });

  it("production out/ includes versioned engine, model, ORT, and headers", () => {
    const outEngine = path.join(ROOT, "out/engine");
    const outOrt = path.join(ROOT, "out/ort/1.27.0");
    const outModels = path.join(ROOT, "out/models");
    const outHeaders = path.join(ROOT, "out/_headers");
    const outReady =
      existsSync(outEngine) &&
      existsSync(outOrt) &&
      existsSync(outModels) &&
      existsSync(outHeaders);

    if (!outReady) {
      if (REQUIRE_OUT) {
        throw new Error(
          "out/ artifacts incomplete — run `bun run build` before the static-host gate",
        );
      }
      // Pre-build unit runs: only require prepared public assets.
      expect(existsSync(path.join(ROOT, "public/engine"))).toBe(true);
      expect(existsSync(path.join(ROOT, "public/ort/1.27.0"))).toBe(true);
      expect(
        existsSync(
          path.join(ROOT, "public/models/maia3-5m.fp16.ca22fc303197.onnx"),
        ),
      ).toBe(true);
      return;
    }

    expect(
      existsSync(path.join(outEngine, "stockfish-18-lite-single.js")),
    ).toBe(true);
    expect(
      existsSync(path.join(outEngine, "stockfish-18-lite-single.wasm")),
    ).toBe(true);
    expect(existsSync(path.join(outOrt, "ort-wasm-simd-threaded.wasm"))).toBe(
      true,
    );
    expect(
      existsSync(path.join(outModels, "maia3-5m.fp16.ca22fc303197.onnx")),
    ).toBe(true);

    const headers = readFileSync(outHeaders, "utf8");
    expect(headers).toMatch(/\/ort\/1\.27\.0\/\*/);
  });
});
