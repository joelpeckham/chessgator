/** Versioned lite-single assets prepared by `scripts/prepare-assets.mjs` from stockfish@18.0.8. */
export const STOCKFISH_LITE_SINGLE_JS =
  "/engine/stockfish-18.0.8-lite-single.js";
export const STOCKFISH_LITE_SINGLE_WASM =
  "/engine/stockfish-18.0.8-lite-single.wasm";

/**
 * Worker URL for the public Stockfish.js entry. Hash pins the WASM path so the
 * loader does not guess a wrong sibling name.
 */
export function stockfishAssetWorkerUrl(
  jsPath: string = STOCKFISH_LITE_SINGLE_JS,
  wasmPath: string = STOCKFISH_LITE_SINGLE_WASM,
): string {
  return `${jsPath}#${encodeURIComponent(wasmPath)}`;
}
