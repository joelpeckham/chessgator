#!/usr/bin/env node
import { readFile } from "node:fs/promises";
/**
 * Narrow static server for Maia browser smoke tests.
 * Serves prepared model asset + generated typed-worker bundle + ORT wasm.
 */
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.MAIA_SMOKE_PORT || 4174);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".json": "application/json",
};

function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  if (clean === "/" || clean === "/index.html") {
    return path.join(__dirname, "fixtures/index.html");
  }
  if (clean.startsWith("/models/")) {
    return path.join(ROOT, "public", clean.slice(1));
  }
  if (clean.startsWith("/ort/")) {
    return path.join(__dirname, ".generated", clean.slice(1));
  }
  if (clean.startsWith("/generated/")) {
    return path.join(
      __dirname,
      ".generated",
      clean.slice("/generated/".length),
    );
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const filePath = resolvePath(req.url || "/");
    const allowedRoots = [
      path.join(ROOT, "public"),
      path.join(__dirname, ".generated"),
      path.join(__dirname, "fixtures"),
    ];
    const allowed =
      filePath &&
      allowedRoots.some(
        (root) =>
          filePath === root ||
          filePath.startsWith(root + path.sep) ||
          filePath === path.join(__dirname, "fixtures/index.html"),
      );
    if (!allowed) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": "no-store",
      // ORT may use SharedArrayBuffer paths in some builds; keep headers ready.
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
      "cross-origin-resource-policy": "cross-origin",
    });
    res.end(data);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(500);
    res.end(String(err));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`maia smoke server on http://127.0.0.1:${PORT}`);
});
