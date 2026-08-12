import { BLUE_NOISE, BLUE_NOISE_SIZE } from "@/components/board/blue-noise";
import {
  VEIL_COVERAGE_CENTER,
  VEIL_COVERAGE_EDGE,
  VEIL_FALLOFF_GAMMA,
  VEIL_RADIUS_INNER,
} from "@/components/board/veil-grid";

export const VEIL_DURATION_MS = 280;

const VERT = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
uniform vec3 uLight;
uniform vec3 uDark;
uniform float uGrid;
uniform float uNoiseSize;
uniform float uProgress;
uniform sampler2D uNoise;

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 uv = (cell + 0.5) / uGrid;
  vec2 centered = uv * 2.0 - 1.0;
  float r = length(centered) / 1.41421356237;
  float t = smoothstep(${VEIL_RADIUS_INNER.toFixed(2)}, 1.0, r);
  t = pow(t, ${VEIL_FALLOFF_GAMMA.toFixed(2)});
  float target = mix(${VEIL_COVERAGE_CENTER.toFixed(2)}, ${VEIL_COVERAGE_EDGE.toFixed(2)}, t);
  float coverage = mix(1.0, target, uProgress);

  vec2 noiseUv = (mod(cell, uNoiseSize) + 0.5) / uNoiseSize;
  float threshold = texture2D(uNoise, noiseUv).r;
  if (threshold >= coverage) discard;

  float file = floor(uv.x * 8.0);
  float rank = floor(uv.y * 8.0);
  bool isLight = mod(file + rank, 2.0) == 1.0;
  gl_FragColor = vec4(isLight ? uLight : uDark, 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createVeilProgram(
  gl: WebGLRenderingContext,
): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    return null;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function createNoiseTexture(gl: WebGLRenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  const rgba = new Uint8Array(BLUE_NOISE.length * 4);
  for (let i = 0; i < BLUE_NOISE.length; i++) {
    const v = BLUE_NOISE[i] ?? 0;
    const o = i * 4;
    rgba[o] = v;
    rgba[o + 1] = v;
    rgba[o + 2] = v;
    rgba[o + 3] = 255;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    BLUE_NOISE_SIZE,
    BLUE_NOISE_SIZE,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    rgba,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return texture;
}

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
  if (!ctx) return [1, 1, 1];
  ctx.fillStyle = parsed;
  ctx.fillRect(0, 0, 1, 1);
  const pixel = ctx.getImageData(0, 0, 1, 1).data;
  return [
    (pixel[0] ?? 255) / 255,
    (pixel[1] ?? 255) / 255,
    (pixel[2] ?? 255) / 255,
  ];
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function paintVeil(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  texture: WebGLTexture,
  lightLoc: WebGLUniformLocation,
  darkLoc: WebGLUniformLocation,
  gridLoc: WebGLUniformLocation,
  noiseSizeLoc: WebGLUniformLocation,
  noiseLoc: WebGLUniformLocation,
  progressLoc: WebGLUniformLocation,
  grid: number,
  progress: number,
  light: [number, number, number],
  dark: [number, number, number],
): void {
  gl.viewport(0, 0, grid, grid);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform3f(lightLoc, light[0], light[1], light[2]);
  gl.uniform3f(darkLoc, dark[0], dark[1], dark[2]);
  gl.uniform1f(gridLoc, grid);
  gl.uniform1f(noiseSizeLoc, BLUE_NOISE_SIZE);
  gl.uniform1i(noiseLoc, 0);
  gl.uniform1f(progressLoc, progress);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
