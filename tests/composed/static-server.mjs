#!/usr/bin/env node
/**
 * Serves the Next static export (`out/`) for real-engine composed smoke tests.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "out");
const PORT = Number(process.env.COMPOSED_E2E_PORT || 4180);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const relative = clean === "/" ? "/index.html" : clean;
  const candidate = path.join(OUT, relative);
  if (!candidate.startsWith(OUT + path.sep) && candidate !== OUT) {
    return null;
  }
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      return path.join(candidate, "index.html");
    }
    return candidate;
  } catch {
    const htmlFallback = path.join(OUT, `${relative}.html`);
    try {
      await stat(htmlFallback);
      return htmlFallback;
    } catch {
      return null;
    }
  }
}

const server = createServer(async (req, res) => {
  try {
    const filePath = await resolveFile(req.url || "/");
    if (!filePath) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`composed smoke server on http://127.0.0.1:${PORT}`);
});
