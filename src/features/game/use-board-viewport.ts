"use client";

import { useSyncExternalStore } from "react";
import {
  GATOR_LEDGE_INSET_PX,
  MASCOT_PEEK_HEIGHT_PX,
  MASCOT_PEEK_WIDTH_PX,
  MASCOT_SPAN_PX,
} from "@/components/coach/gator-layout";
import { SITE_FOOTER_H } from "@/components/site-footer";
import {
  TIMELINE_EXPANDED_HEIGHT_PX,
  TIMELINE_GRAPH_HEIGHT_PX,
} from "@/components/timeline/move-timeline";

/** Reserved chrome so board size ignores floating coach/toasts. */
const HEADER_RESERVE_PX = 48;
/** Extra footer chrome around the timeline (mascot ledge, padding). */
const TIMELINE_EXTRA_CHROME_PX = 36;

function footerChromePx(timelineExpanded: boolean): number {
  return (
    (timelineExpanded
      ? TIMELINE_EXPANDED_HEIGHT_PX
      : TIMELINE_GRAPH_HEIGHT_PX) +
    TIMELINE_EXTRA_CHROME_PX +
    SITE_FOOTER_H
  );
}
/** Breathing room right of the board in the beside layout. */
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
  /** Viewport x of the gator's left edge; hugs the board's left side. */
  mascotLeft: number;
};

function subscribeViewport(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function clampBoard(size: number): number {
  return Math.max(BOARD_MIN_PX, Math.min(BOARD_MAX_PX, Math.floor(size)));
}

/**
 * Gator peeks from the timeline ledge at the board's left edge, and the
 * gator+board pair centers as a group. The board snaps above the peek once
 * the stacked rectangle is larger; the gator then stays near the screen's
 * left edge. Advice is a floating balloon and does not reserve a column.
 */
export function computeViewportLayout(
  innerWidth: number,
  innerHeight: number,
  timelineExpanded = false,
): ViewportLayout {
  const availH =
    innerHeight -
    HEADER_RESERVE_PX -
    footerChromePx(timelineExpanded) -
    VIEWPORT_PAD_Y_PX;
  const sizeBeside = clampBoard(
    Math.min(innerWidth - MASCOT_PEEK_WIDTH_PX - BESIDE_PAD_X_PX, availH),
  );
  const sizeStacked = clampBoard(
    Math.min(innerWidth - STACKED_PAD_X_PX, availH - MASCOT_PEEK_HEIGHT_PX),
  );
  const mascotBelow = sizeStacked > sizeBeside;
  const boardSize = mascotBelow ? sizeStacked : sizeBeside;
  if (mascotBelow) {
    return {
      boardSize,
      mascotBelow,
      boardLeft: Math.floor((innerWidth - boardSize) / 2),
      mascotLeft: GATOR_LEDGE_INSET_PX,
    };
  }
  const groupLeft = Math.max(
    0,
    Math.floor((innerWidth - MASCOT_PEEK_WIDTH_PX - boardSize) / 2),
  );
  const boardLeft = groupLeft + MASCOT_PEEK_WIDTH_PX;
  return {
    boardSize,
    mascotBelow,
    boardLeft,
    mascotLeft: Math.max(GATOR_LEDGE_INSET_PX, boardLeft - MASCOT_SPAN_PX),
  };
}

function readWidth(): number {
  return window.innerWidth;
}

function readHeight(): number {
  return window.innerHeight;
}

const SSR_LAYOUT: ViewportLayout = {
  boardSize: 640,
  mascotBelow: false,
  boardLeft: 320,
  mascotLeft: 216,
};

export function useBoardViewport(timelineExpanded = false): ViewportLayout {
  const innerWidth = useSyncExternalStore(
    subscribeViewport,
    readWidth,
    () => 0,
  );
  const innerHeight = useSyncExternalStore(
    subscribeViewport,
    readHeight,
    () => 0,
  );
  if (innerWidth === 0 || innerHeight === 0) return SSR_LAYOUT;
  return computeViewportLayout(innerWidth, innerHeight, timelineExpanded);
}
