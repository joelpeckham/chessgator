"use client";

import { useSyncExternalStore } from "react";
import {
  MASCOT_PEEK_HEIGHT_PX,
  MASCOT_PEEK_WIDTH_PX,
} from "@/components/coach/gator-layout";
import { TIMELINE_GRAPH_HEIGHT_PX } from "@/components/timeline/move-timeline";

/** Reserved chrome so board size ignores floating coach/toasts. */
const HEADER_RESERVE_PX = 48;
/** Timeline status row + fixed graph. */
const TIMELINE_CHROME_PX = TIMELINE_GRAPH_HEIGHT_PX + 36;
const FOOTER_CHROME_PX = TIMELINE_CHROME_PX;
/** pr-4 on the board column; left pad lives inside the mascot peek. */
const BESIDE_PAD_X_PX = 16;
/** px-4 around the stacked board. */
const STACKED_PAD_X_PX = 32;
const VIEWPORT_PAD_Y_PX = 24;
const BOARD_MAX_PX = 960;
const BOARD_MIN_PX = 200;

export type ViewportLayout = {
  boardSize: number;
  mascotBelow: boolean;
  /** Left offset of the board in the main pane; never enters the mascot peek. */
  boardLeft: number;
};

function subscribeViewport(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function clampBoard(size: number): number {
  return Math.max(BOARD_MIN_PX, Math.min(BOARD_MAX_PX, Math.floor(size)));
}

/**
 * Gator peeks from the timeline ledge. The board uses the leftover
 * rectangle and snaps above the peek once that rectangle is larger.
 */
export function computeViewportLayout(
  innerWidth: number,
  innerHeight: number,
): ViewportLayout {
  const availH =
    innerHeight - HEADER_RESERVE_PX - FOOTER_CHROME_PX - VIEWPORT_PAD_Y_PX;
  const sizeBeside = clampBoard(
    Math.min(innerWidth - MASCOT_PEEK_WIDTH_PX - BESIDE_PAD_X_PX, availH),
  );
  const sizeStacked = clampBoard(
    Math.min(innerWidth - STACKED_PAD_X_PX, availH - MASCOT_PEEK_HEIGHT_PX),
  );
  const mascotBelow = sizeStacked > sizeBeside;
  const boardSize = mascotBelow ? sizeStacked : sizeBeside;
  const centeredLeft = Math.floor((innerWidth - boardSize) / 2);
  const boardLeft = mascotBelow
    ? centeredLeft
    : Math.max(MASCOT_PEEK_WIDTH_PX, centeredLeft);
  return {
    boardSize,
    mascotBelow,
    boardLeft,
  };
}

function readViewportLayout(): ViewportLayout {
  return computeViewportLayout(window.innerWidth, window.innerHeight);
}

const SSR_LAYOUT: ViewportLayout = {
  boardSize: 640,
  mascotBelow: false,
  boardLeft: 320,
};

export function useBoardViewport(): ViewportLayout {
  const boardSize = useSyncExternalStore(
    subscribeViewport,
    () => readViewportLayout().boardSize,
    () => SSR_LAYOUT.boardSize,
  );
  const mascotBelow = useSyncExternalStore(
    subscribeViewport,
    () => readViewportLayout().mascotBelow,
    () => SSR_LAYOUT.mascotBelow,
  );
  const boardLeft = useSyncExternalStore(
    subscribeViewport,
    () => readViewportLayout().boardLeft,
    () => SSR_LAYOUT.boardLeft,
  );
  return { boardSize, mascotBelow, boardLeft };
}
