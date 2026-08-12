"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { veilGridSize } from "@/components/board/veil-grid";
import {
  createNoiseTexture,
  createVeilProgram,
  paintVeil,
  prefersReducedMotion,
  readCssVarRgb,
  VEIL_DURATION_MS,
} from "@/components/board/veil-webgl";

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
 * Main-board dither overlay while scrubbing a non-live timeline position.
 * Distinct from `BoardPreview`, the small popover mini-board.
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

    const program = createVeilProgram(gl);
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
      const t = Math.min(1, elapsed / VEIL_DURATION_MS);
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
