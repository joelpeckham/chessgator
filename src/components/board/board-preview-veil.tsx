"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BLUE_NOISE, BLUE_NOISE_SIZE } from "@/components/board/blue-noise";
import {
  VEIL_COVERAGE_CENTER,
  VEIL_COVERAGE_EDGE,
  VEIL_FALLOFF_GAMMA,
  VEIL_RADIUS_INNER,
  veilGridSize,
} from "@/components/board/veil-grid";

const DURATION_MS = 280;

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

function createProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
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

function createNoiseTexture(gl: WebGLRenderingContext): WebGLTexture {
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

function readCssVarRgb(varName: string): [number, number, number] {
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

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function paintVeil(
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

function subscribeBoardHost(onChange: () => void): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) onChange();
  });
  return () => {
    cancelled = true;
  };
}

function getBoardHost(): HTMLElement | null {
  return document.getElementById("chessgator-board-board");
}

/**
 * Blue-noise checkerboard stipple with holes to the page. Square DOM fills
 * are cleared once the renderer is covering so discarded cells show `--background`.
 */
export function BoardPreviewVeil({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const kickRef = useRef<() => void>(() => {});
  const host = useSyncExternalStore(
    subscribeBoardHost,
    getBoardHost,
    () => null,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !host) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl || gl.isContextLost()) return;

    const program = createProgram(gl, VERT, FRAG);
    if (!program) return;
    const texture = createNoiseTexture(gl);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const lightLoc = gl.getUniformLocation(program, "uLight");
    const darkLoc = gl.getUniformLocation(program, "uDark");
    const gridLoc = gl.getUniformLocation(program, "uGrid");
    const noiseSizeLoc = gl.getUniformLocation(program, "uNoiseSize");
    const noiseLoc = gl.getUniformLocation(program, "uNoise");
    const progressLoc = gl.getUniformLocation(program, "uProgress");
    if (
      !lightLoc ||
      !darkLoc ||
      !gridLoc ||
      !noiseSizeLoc ||
      !noiseLoc ||
      !progressLoc
    ) {
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      return;
    }

    let grid = 0;
    let progress = 0;
    let from = 0;
    let to = 0;
    let startTime = 0;
    let raf = 0;
    let light: [number, number, number] = [1, 1, 1];
    let dark: [number, number, number] = [0, 0, 0];

    const veilEl = () => canvas.parentElement;

    const setCovering = (on: boolean) => {
      veilEl()?.setAttribute("data-active", on ? "true" : "false");
    };

    const refreshColors = () => {
      light = readCssVarRgb("--board-light");
      dark = readCssVarRgb("--board-dark");
    };

    const paint = (nextProgress: number) => {
      if (gl.isContextLost()) return;
      const next = veilGridSize(host.getBoundingClientRect().width);
      if (next !== grid) {
        grid = next;
        canvas.width = grid;
        canvas.height = grid;
      }
      paintVeil(
        gl,
        program,
        texture,
        lightLoc,
        darkLoc,
        gridLoc,
        noiseSizeLoc,
        noiseLoc,
        progressLoc,
        grid,
        nextProgress,
        light,
        dark,
      );
    };

    const tick = (now: number) => {
      raf = 0;
      const target = activeRef.current ? 1 : 0;
      if (prefersReducedMotion()) {
        progress = target;
        paint(progress);
        setCovering(target === 1);
        return;
      }
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      progress = from + (to - from) * eased;
      paint(progress);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      progress = to;
      if (progress === 0 && !activeRef.current) setCovering(false);
    };

    const kick = () => {
      const target = activeRef.current ? 1 : 0;
      if (target === 1) {
        if (progress === 0) paint(0);
        setCovering(true);
      }
      if (prefersReducedMotion()) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        progress = target;
        paint(progress);
        setCovering(target === 1);
        return;
      }
      if (progress === target && raf === 0) return;
      from = progress;
      to = target;
      startTime = performance.now();
      if (raf === 0) raf = requestAnimationFrame(tick);
    };

    refreshColors();
    paint(0);
    canvas.parentElement?.setAttribute("data-ready", "true");
    kickRef.current = kick;
    kick();

    const theme = new MutationObserver(() => {
      refreshColors();
      paint(progress);
    });
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    const resize = new ResizeObserver(() => {
      paint(progress);
    });
    resize.observe(host);

    const onLost = (event: Event) => {
      event.preventDefault();
      canvas.parentElement?.setAttribute("data-ready", "false");
      setCovering(false);
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      kickRef.current = () => {};
      canvas.removeEventListener("webglcontextlost", onLost);
      theme.disconnect();
      resize.disconnect();
      if (raf) cancelAnimationFrame(raf);
      canvas.parentElement?.setAttribute("data-ready", "false");
      setCovering(false);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    };
  }, [host]);

  useEffect(() => {
    activeRef.current = active;
    kickRef.current();
  }, [active]);

  if (!host) return null;

  return createPortal(
    <div
      className="board-preview-veil pointer-events-none absolute inset-0 z-1 overflow-hidden rounded-(--radius) bg-transparent opacity-0 data-[active=true]:opacity-100"
      data-testid="board-preview-veil"
      data-active="false"
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full bg-transparent [image-rendering:pixelated]"
        aria-hidden
      />
    </div>,
    host,
  );
}
