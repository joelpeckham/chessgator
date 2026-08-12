#!/usr/bin/env node
/**
 * Copy/download pinned Stockfish + ORT + Maia assets, verify SHA-256, write under public/.
 *
 * Usage:
 *   bun run prepare:assets
 *   node scripts/prepare-assets.mjs [--force] [--verify-only]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCK_PATH = path.join(ROOT, "assets.lock.json");

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const VERIFY_ONLY = args.has("--verify-only");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readLock() {
  const raw = await readFile(LOCK_PATH, "utf8");
  const lock = JSON.parse(raw);
  if (!Array.isArray(lock.assets) || lock.assets.length === 0) {
    throw new Error("assets.lock.json must contain a non-empty assets array");
  }
  return lock;
}

async function readInstalledPackageVersion(packageName) {
  const pkgPath = path.join(ROOT, "node_modules", packageName, "package.json");
  try {
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

async function assertInstalledPackageVersions(assets) {
  const expected = new Map();
  for (const asset of assets) {
    if (!asset.sourcePackage || !asset.sourcePackageVersion) continue;
    expected.set(asset.sourcePackage, String(asset.sourcePackageVersion));
  }

  for (const [packageName, expectedVersion] of expected) {
    const installed = await readInstalledPackageVersion(packageName);
    if (!installed) {
      throw new Error(
        `Installed package missing for lock assertion: ${packageName}`,
      );
    }
    if (installed !== expectedVersion) {
      throw new Error(
        `Package version mismatch for ${packageName}\n` +
          `  assets.lock.json: ${expectedVersion}\n` +
          `  installed:        ${installed}`,
      );
    }
    console.log(`ok  package ${packageName}@${installed}`);
  }
}

async function ensureParent(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function fileMatches(destAbs, expectedSha) {
  try {
    const buf = await readFile(destAbs);
    return sha256(buf) === expectedSha;
  } catch (err) {
    if (err && err.code === "ENOENT") return false;
    throw err;
  }
}

async function downloadTo(url, destAbs) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      // HF may serve HTML without an Accept that prefers the binary.
      Accept: "application/octet-stream",
    },
  });
  if (!res.ok) {
    throw new Error(
      `Download failed (${res.status} ${res.statusText}): ${url}`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = `${destAbs}.tmp`;
  await ensureParent(destAbs);
  await writeFile(tmp, buf);
  await rename(tmp, destAbs);
  return buf;
}

async function copyFromPackage(sourceRel, destAbs) {
  const sourceAbs = path.join(ROOT, sourceRel);
  const buf = await readFile(sourceAbs);
  const tmp = `${destAbs}.tmp`;
  await ensureParent(destAbs);
  await writeFile(tmp, buf);
  await rename(tmp, destAbs);
  return buf;
}

async function verifyBuffer(id, buf, expectedSha, expectedBytes) {
  const actual = sha256(buf);
  if (actual !== expectedSha) {
    throw new Error(
      `[${id}] SHA-256 mismatch\n  expected: ${expectedSha}\n  actual:   ${actual}`,
    );
  }
  if (typeof expectedBytes === "number" && buf.length !== expectedBytes) {
    throw new Error(
      `[${id}] size mismatch\n  expected: ${expectedBytes}\n  actual:   ${buf.length}`,
    );
  }
}

async function prepareAsset(asset) {
  const destAbs = path.join(ROOT, asset.destination);
  const expectedSha = String(asset.sha256).toLowerCase();

  if (VERIFY_ONLY) {
    const buf = await readFile(destAbs);
    await verifyBuffer(asset.id, buf, expectedSha, asset.bytes);
    console.log(`ok  verify ${asset.destination}`);
    return;
  }

  if (!FORCE && (await fileMatches(destAbs, expectedSha))) {
    console.log(`ok  cached  ${asset.destination}`);
    return;
  }

  let buf;
  if (asset.kind === "copy") {
    if (!asset.sourcePath) {
      throw new Error(`[${asset.id}] copy assets require sourcePath`);
    }
    console.log(`... copy   ${asset.sourcePath} -> ${asset.destination}`);
    buf = await copyFromPackage(asset.sourcePath, destAbs);
  } else if (asset.kind === "download") {
    if (!asset.url) {
      throw new Error(`[${asset.id}] download assets require url`);
    }
    console.log(`... fetch  ${asset.url}`);
    buf = await downloadTo(asset.url, destAbs);
  } else {
    throw new Error(`[${asset.id}] unknown kind: ${asset.kind}`);
  }

  try {
    await verifyBuffer(asset.id, buf, expectedSha, asset.bytes);
  } catch (err) {
    await rm(destAbs, { force: true });
    throw err;
  }

  console.log(`ok  wrote   ${asset.destination}`);
}

async function main() {
  const lock = await readLock();
  console.log(
    `prepare-assets: ${lock.assets.length} asset(s)` +
      (FORCE ? " (--force)" : "") +
      (VERIFY_ONLY ? " (--verify-only)" : ""),
  );

  await assertInstalledPackageVersions(lock.assets);

  for (const asset of lock.assets) {
    if (!asset.id || !asset.destination || !asset.sha256) {
      throw new Error("Each asset requires id, destination, and sha256");
    }
    await prepareAsset(asset);
  }

  console.log("prepare-assets: done");
}

main().catch(async (err) => {
  console.error(`prepare-assets: ${err.message || err}`);
  process.exitCode = 1;
});
