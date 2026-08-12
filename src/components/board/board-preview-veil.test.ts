import { describe, expect, it } from "vitest";
import { BLUE_NOISE, BLUE_NOISE_SIZE } from "@/components/board/blue-noise";
import {
  VEIL_COVERAGE_CENTER,
  VEIL_COVERAGE_EDGE,
  VEIL_GRID_MAX,
  VEIL_GRID_MIN,
  veilCoverage,
  veilGridSize,
} from "@/components/board/veil-grid";

function stats(bytes: Uint8Array): { min: number; max: number; mean: number } {
  let min = 255;
  let max = 0;
  let sum = 0;
  for (const v of bytes) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, mean: sum / bytes.length };
}

function meanAbsLag(dx: number, dy: number): number {
  let sum = 0;
  for (let y = 0; y < BLUE_NOISE_SIZE; y++) {
    for (let x = 0; x < BLUE_NOISE_SIZE; x++) {
      const a = BLUE_NOISE[y * BLUE_NOISE_SIZE + x] ?? 0;
      const b =
        BLUE_NOISE[
          ((y + dy) % BLUE_NOISE_SIZE) * BLUE_NOISE_SIZE +
            ((x + dx) % BLUE_NOISE_SIZE)
        ] ?? 0;
      sum += Math.abs(a - b);
    }
  }
  return sum / BLUE_NOISE.length;
}

describe("blue-noise threshold map", () => {
  it("is a 128×128 tile with a full 8-bit range and mid-gray mean", () => {
    expect(BLUE_NOISE_SIZE).toBe(128);
    expect(BLUE_NOISE).toHaveLength(128 * 128);
    const { min, max, mean } = stats(BLUE_NOISE);
    expect(min).toBe(0);
    expect(max).toBe(255);
    expect(mean).toBeCloseTo(127.5, 1);
  });

  it("does not repeat on an 8-cell Bayer period", () => {
    expect(meanAbsLag(8, 0)).toBeGreaterThan(50);
    expect(meanAbsLag(0, 8)).toBeGreaterThan(50);
  });
});

describe("veilCoverage", () => {
  it("is fully solid at progress 0 and matches the radial target at progress 1", () => {
    expect(veilCoverage(0, 0)).toBe(1);
    expect(veilCoverage(0, 1)).toBe(1);
    expect(veilCoverage(1, 0)).toBeCloseTo(VEIL_COVERAGE_CENTER);
    expect(veilCoverage(1, 1)).toBeCloseTo(VEIL_COVERAGE_EDGE);
  });

  it("opens holes at the rim before the center", () => {
    const midCenter = veilCoverage(0.5, 0);
    const midEdge = veilCoverage(0.5, 1);
    expect(midEdge).toBeLessThan(midCenter);
    expect(midCenter).toBeGreaterThan(VEIL_COVERAGE_CENTER);
    expect(midEdge).toBeGreaterThan(VEIL_COVERAGE_EDGE);
  });
});

describe("veilGridSize", () => {
  it("snaps to a multiple of eight between the min and max", () => {
    expect(veilGridSize(433) % 8).toBe(0);
    expect(veilGridSize(433)).toBe(144);
    expect(veilGridSize(200)).toBe(VEIL_GRID_MIN);
    expect(veilGridSize(960)).toBe(VEIL_GRID_MAX);
    expect(veilGridSize(0)).toBe(VEIL_GRID_MIN);
    expect(veilGridSize(Number.NaN)).toBe(VEIL_GRID_MIN);
  });
});
