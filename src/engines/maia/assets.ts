/** Content-addressed Maia3 5M fp16 ONNX asset prepared by `scripts/prepare-assets.mjs`. */
export const MAIA3_5M_FP16_ONNX = "/models/maia3-5m.fp16.ca22fc303197.onnx";

/**
 * Versioned public path prefix for onnxruntime-web WASM binaries.
 * Copied from `node_modules/onnxruntime-web/dist/` by prepare:assets into
 * `public/ort/<version>/` (see assets.lock.json). Overridable via Maia init for tests.
 */
const MAIA_ORT_VERSION = "1.27.0";
export const MAIA_ORT_WASM_PATHS = `/ort/${MAIA_ORT_VERSION}/`;
