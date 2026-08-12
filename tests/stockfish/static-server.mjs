#!/usr/bin/env node
/**
 * Narrow static server for Stockfish browser smoke tests.
 * Serves prepared engine assets + generated typed-worker bundle.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.STOCKFISH_SMOKE_PORT || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json",
};

function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  if (clean === "/" || clean === "/index.html") {
    return path.join(__dirname, "fixtures/index.html");
  }
  if (clean.startsWith("/engine/")) {
    return path.join(ROOT, "public", clean.slice(1));
  }
  if (clean.startsWith("/generated/")) {
    return path.join(__dirname, ".generated", clean.slice("/generated/".length));
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const filePath = resolvePath(req.url || "/");
    const allowedRoot = path.join(ROOT, "public");
    const allowed =
      filePath &&
      (filePath.startsWith(allowedRoot + path.sep) ||
        filePath.startsWith(__dirname + path.sep) ||
        filePath === path.join(__dirname, "fixtures/index.html"));
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
  console.log(`stockfish smoke server on http://127.0.0.1:${PORT}`);
});
