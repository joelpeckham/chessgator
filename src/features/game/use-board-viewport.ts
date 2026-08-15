"use client";

import { useSyncExternalStore } from "react";
import {
  COACH_COLUMN_WIDTH_PX,
  MASCOT_PEEK_HEIGHT_PX,
  MASCOT_PEEK_WIDTH_PX,
} from "@/components/coach/gator-layout";
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
      : TIMELINE_GRAPH_HEIGHT_PX) + TIMELINE_EXTRA_CHROME_PX
  );
}
/** Gap between the docked coach lane and the board. */
const BESIDE_PAD_X_PX = 16;
/** px-4 around the stacked board. */
const STACKED_PAD_X_PX = 32;
const VIEWPORT_PAD_Y_PX = 24;
const BOARD_MAX_PX = 960;
const BOARD_MIN_PX = 200;
const BOARD_DOCK_MIN_PX = 480;

export type ViewportLayout = {
  boardSize: number;
  mascotBelow: boolean;
  /** Left offset of the board in the main pane; never enters the mascot peek. */
  boardLeft: number;
  coachDocked: boolean;
  /** Left edge of the docked coach+board group; 0 when the lane is not reserved. */
  coachLaneLeft: number;
};

function dockedGroupWidth(boardSize: number): number {
  return COACH_COLUMN_WIDTH_PX + BESIDE_PAD_X_PX + boardSize;
}

function dockedLaneLeft(innerWidth: number, boardSize: number): number {
  return Math.max(
    0,
    Math.floor((innerWidth - dockedGroupWidth(boardSize)) / 2),
  );
}

function subscribeViewport(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function clampBoard(size: number): number {
  return Math.max(BOARD_MIN_PX, Math.min(BOARD_MAX_PX, Math.floor(size)));
}

/**
 * Gator peeks from the left timeline ledge. The board uses the leftover
 * rectangle and snaps above the peek once that rectangle is larger.
 * Wide/tall viewports reserve a coach lane and center it with the board.
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
  const sizeDocked = clampBoard(
    Math.min(innerWidth - COACH_COLUMN_WIDTH_PX - BESIDE_PAD_X_PX, availH),
  );
  if (sizeDocked >= BOARD_DOCK_MIN_PX) {
    return {
      boardSize: sizeDocked,
      mascotBelow: false,
      boardLeft: 0,
      coachDocked: true,
      coachLaneLeft: dockedLaneLeft(innerWidth, sizeDocked),
    };
  }
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
    coachDocked: false,
    coachLaneLeft: 0,
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
  coachDocked: false,
  coachLaneLeft: 0,
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
