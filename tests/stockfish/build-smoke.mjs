#!/usr/bin/env node
/**
 * Bundle the typed Stockfish worker for the Playwright smoke page.
 * Uses only the lite-single public asset path at runtime (never package default).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "bun";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const outdir = path.join(__dirname, ".generated");

await mkdir(outdir, { recursive: true });

const result = await build({
  entrypoints: [path.join(ROOT, "src/workers/stockfish-worker.ts")],
  outdir,
  target: "browser",
  format: "esm",
  naming: "stockfish-worker.js",
  minify: false,
  plugins: [
    {
      name: "tsconfig-paths",
      setup(buildApi) {
        buildApi.onResolve({ filter: /^@\// }, (args) => {
          const base = path.join(ROOT, "src", args.path.slice(2));
          return { path: base.endsWith(".ts") ? base : `${base}.ts` };
        });
      },
    },
  ],
});

if (!result.success) {
  console.error(result.logs);
  process.exit(1);
}

console.log("bundled tests/stockfish/.generated/stockfish-worker.js");
