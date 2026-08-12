"use client";

import { useSyncExternalStore } from "react";
import { COACH_RAIL_PX } from "@/components/coach/coach-rail";
import { TIMELINE_GRAPH_HEIGHT_PX } from "@/components/timeline/move-timeline";

/** Reserved chrome so board size ignores floating coach/toasts. */
const HEADER_RESERVE_PX = 48;
/** Timeline status row + fixed graph + transport chrome. */
const TIMELINE_CHROME_PX = TIMELINE_GRAPH_HEIGHT_PX + 36;
/** Fixed footer footprint: coach rail + timeline (never grows with expansion). */
const FOOTER_CHROME_PX = COACH_RAIL_PX + TIMELINE_CHROME_PX;
const VIEWPORT_PAD_PX = 24;
const BOARD_MAX_PX = 960;
const BOARD_MIN_PX = 200;
const COMPACT_BREAKPOINT_PX = 640;

function subscribeViewport(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function computeBoardSize(): number {
  const availW = window.innerWidth - VIEWPORT_PAD_PX;
  const availH =
    window.innerHeight - HEADER_RESERVE_PX - FOOTER_CHROME_PX - VIEWPORT_PAD_PX;
  return Math.max(
    BOARD_MIN_PX,
    Math.min(BOARD_MAX_PX, Math.floor(Math.min(availW, availH))),
  );
}

function computeCompact(): boolean {
  return window.innerWidth < COMPACT_BREAKPOINT_PX;
}

export function useBoardViewport(): { boardSize: number; compact: boolean } {
  const boardSize = useSyncExternalStore(
    subscribeViewport,
    computeBoardSize,
    () => 640,
  );
  const compact = useSyncExternalStore(
    subscribeViewport,
    computeCompact,
    () => false,
  );
  return { boardSize, compact };
}
