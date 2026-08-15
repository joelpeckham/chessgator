import { BLUE_NOISE_SIZE, getBlueNoise } from "@/components/board/blue-noise";
import {
  VEIL_COVERAGE_CENTER,
  VEIL_COVERAGE_EDGE,
  VEIL_FALLOFF_GAMMA,
  VEIL_RADIUS_INNER,
} from "@/components/board/veil-grid";

export const VEIL_DURATION_MS = 280;

export function readCssVarRgb(varName: string): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.backgroundColor = `var(${varName})`;
  document.body.append(probe);
  const parsed = getComputedStyle(probe).backgroundColor;
  probe.remove();

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [255, 255, 255];
  ctx.fillStyle = parsed;
  ctx.fillRect(0, 0, 1, 1);
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  return [pixel[0] ?? 255, pixel[1] ?? 255, pixel[2] ?? 255];
}

function coverageAt(progress: number, uvx: number, uvy: number): number {
  const cx = uvx * 2 - 1;
  const cy = uvy * 2 - 1;
  const r = Math.hypot(cx, cy) / Math.SQRT2;
  let t = (r - VEIL_RADIUS_INNER) / (1 - VEIL_RADIUS_INNER);
  t = Math.min(1, Math.max(0, t));
  t **= VEIL_FALLOFF_GAMMA;
  const target =
    VEIL_COVERAGE_CENTER + (VEIL_COVERAGE_EDGE - VEIL_COVERAGE_CENTER) * t;
  return 1 + (target - 1) * progress;
}

export function paintVeil(
  ctx: CanvasRenderingContext2D,
  grid: number,
  progress: number,
  light: [number, number, number],
  dark: [number, number, number],
): void {
  const noise = getBlueNoise();
  const image = ctx.createImageData(grid, grid);
  const data = image.data;
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const uvx = (x + 0.5) / grid;
      const uvy = 1 - (y + 0.5) / grid;
      const keep = noise
        ? noise[
            (y % BLUE_NOISE_SIZE) * BLUE_NOISE_SIZE + (x % BLUE_NOISE_SIZE)
          ]! /
            255 <
          coverageAt(progress, uvx, uvy)
        : true;
      if (!keep) continue;
      const file = Math.floor(uvx * 8);
      const rank = Math.floor(uvy * 8);
      const isLight = (file + rank) % 2 === 1;
      const color = isLight ? light : dark;
      const i = (y * grid + x) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}
