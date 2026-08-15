#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
/**
 * Serves the Next static export (`out/`) for playable-slice Playwright tests.
 */
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "out");
const PORT = Number(process.env.E2E_PORT || 4175);

const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

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
    // App Router static export may use trailing folders.
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
      res.writeHead(404, SECURITY_HEADERS);
      res.end("not found");
      return;
    }
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": "no-store",
      ...SECURITY_HEADERS,
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, SECURITY_HEADERS);
    res.end(String(err));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`e2e server on http://127.0.0.1:${PORT}`);
});
