#!/usr/bin/env node
/**
 * Bundle the typed Maia worker for the Playwright smoke page and stage
 * onnxruntime-web WASM binaries next to the harness under a versioned path.
 */
import { cp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "bun";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const outdir = path.join(__dirname, ".generated");
const ortSrc = path.join(ROOT, "node_modules/onnxruntime-web/dist");
const ortVersion = "1.27.0";
const ortOut = path.join(outdir, "ort", ortVersion);

await mkdir(outdir, { recursive: true });
await mkdir(ortOut, { recursive: true });

const result = await build({
  entrypoints: [path.join(ROOT, "src/workers/maia-worker.ts")],
  outdir,
  target: "browser",
  format: "esm",
  naming: "maia-worker.js",
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

// Stage ORT WASM / JS sidecars used by the worker at runtime.
const ortFiles = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];

for (const file of ortFiles) {
  await cp(path.join(ortSrc, file), path.join(ortOut, file));
}

// Sanity: versioned ORT path stays wired in source constants.
const assetsTs = await readFile(
  path.join(ROOT, "src/engines/maia/assets.ts"),
  "utf8",
);
if (
  !assetsTs.includes(`MAIA_ORT_VERSION = "${ortVersion}"`) &&
  !assetsTs.includes(`MAIA_ORT_VERSION="${ortVersion}"`)
) {
  throw new Error(`Maia ORT version constant missing ${ortVersion}`);
}
if (!assetsTs.includes("maia3-5m.fp16.ca22fc303197.onnx")) {
  throw new Error(
    "Maia model path constant missing content-addressed filename",
  );
}

console.log("bundled tests/maia/.generated/maia-worker.js");
console.log(
  `staged onnxruntime-web wasm under tests/maia/.generated/ort/${ortVersion}/`,
);
