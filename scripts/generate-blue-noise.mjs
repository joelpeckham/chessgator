#!/usr/bin/env bun
/**
 * Offline void-and-cluster blue-noise generator (Ulichney).
 * Writes src/components/board/blue-noise.ts
 *
 * Incremental Gaussian updates keep 128×128 generation practical.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 128;
const SIGMA = 1.5;
const SEED = 0xc0ffee;
const MINORITY_RATIO = 0.1;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildKernel(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const twoSigma2 = 2 * sigma * sigma;
  const weights = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const w = Math.exp(-(dx * dx + dy * dy) / twoSigma2);
      if (w > 1e-6) weights.push({ dx, dy, w });
    }
  }
  return { radius, weights };
}

function createField(size, kernel) {
  const n = size * size;
  const binary = new Uint8Array(n);
  const density = new Float64Array(n);

  function index(x, y) {
    return ((y + size) % size) * size + ((x + size) % size);
  }

  function addPixel(i, sign) {
    const x = i % size;
    const y = (i / size) | 0;
    binary[i] = sign > 0 ? 1 : 0;
    for (const { dx, dy, w } of kernel.weights) {
      density[index(x + dx, y + dy)] += sign * w;
    }
  }

  function tightestCluster(exclude = -1) {
    let best = -1;
    let bestVal = -Infinity;
    for (let i = 0; i < n; i++) {
      if (!binary[i] || i === exclude) continue;
      const v = density[i];
      if (v > bestVal) {
        bestVal = v;
        best = i;
      }
    }
    return best;
  }

  function largestVoid(exclude = -1) {
    let best = -1;
    let bestVal = Infinity;
    for (let i = 0; i < n; i++) {
      if (binary[i] || i === exclude) continue;
      const v = density[i];
      if (v < bestVal) {
        bestVal = v;
        best = i;
      }
    }
    return best;
  }

  return { n, binary, addPixel, tightestCluster, largestVoid };
}

function generate(size) {
  const kernel = buildKernel(SIGMA);
  const field = createField(size, kernel);
  const rand = mulberry32(SEED);
  const minority = Math.max(1, Math.round(size * size * MINORITY_RATIO));

  const used = new Set();
  while (used.size < minority) {
    const i = (rand() * field.n) | 0;
    if (used.has(i)) continue;
    used.add(i);
    field.addPixel(i, 1);
  }

  for (let guard = 0; guard < field.n; guard++) {
    const cluster = field.tightestCluster();
    const voidIdx = field.largestVoid();
    if (cluster < 0 || voidIdx < 0) break;
    field.addPixel(cluster, -1);
    field.addPixel(voidIdx, 1);
    if (field.tightestCluster() === voidIdx) break;
  }

  const prototype = Uint8Array.from(field.binary);
  const ranks = new Uint16Array(field.n);
  let rank = minority - 1;
  for (let k = 0; k < minority; k++) {
    const cluster = field.tightestCluster();
    ranks[cluster] = rank--;
    field.addPixel(cluster, -1);
  }

  for (let i = 0; i < field.n; i++) {
    if (prototype[i]) field.addPixel(i, 1);
  }

  rank = minority;
  for (let k = minority; k < field.n; k++) {
    const voidIdx = field.largestVoid();
    ranks[voidIdx] = rank++;
    field.addPixel(voidIdx, 1);
  }

  const out = new Uint8Array(field.n);
  const denom = field.n - 1;
  for (let i = 0; i < field.n; i++) {
    out[i] = Math.round((255 * ranks[i]) / denom);
  }
  return out;
}

function toBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function wrapBase64(b64, width = 76) {
  const lines = [];
  for (let i = 0; i < b64.length; i += width) {
    lines.push(`  "${b64.slice(i, i + width)}"`);
  }
  return `[\n${lines.join(",\n")}\n].join("")`;
}

const bytes = generate(SIZE);
const mean = bytes.reduce((s, v) => s + v, 0) / bytes.length;
const min = bytes.reduce((m, v) => Math.min(m, v), 255);
const max = bytes.reduce((m, v) => Math.max(m, v), 0);
console.log(
  `blue-noise ${SIZE}×${SIZE}: min=${min} max=${max} mean=${mean.toFixed(2)}`,
);

const dest = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/components/board/blue-noise.ts",
);

const source = `/**
 * 128×128 void-and-cluster blue-noise thresholds (Ulichney).
 * Generated offline by scripts/generate-blue-noise.mjs (seed 0xc0ffee, σ=1.5).
 * Values are 0–255 and tile seamlessly.
 */
export const BLUE_NOISE_SIZE = ${SIZE};

const BLUE_NOISE_B64 = ${wrapBase64(toBase64(bytes))};

function decodeBlueNoise(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const BLUE_NOISE = decodeBlueNoise(BLUE_NOISE_B64);
`;

await writeFile(dest, source);
console.log(`wrote ${dest}`);
