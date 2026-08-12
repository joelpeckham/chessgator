"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";
import { BoardPreview } from "@/components/board/board-preview";
import {
  buildBranchGraph,
  type TimelineGraphNode,
} from "@/components/timeline/branch-graph";
import type { ProjectedLine } from "@/domain/analysis";
import type { GameTree } from "@/domain/game";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiSkipBackLine,
  RiSkipForwardLine,
  RiChat3Line,
} from "@remixicon/react";

export type MoveTimelineProps = {
  tree: GameTree;
  reviewNodeId: string | null;
  futureLine?: ProjectedLine | null;
  tutorLine?: ProjectedLine | null;
  disabled?: boolean;
  tutorOpen?: boolean;
  canOpenTutor?: boolean;
  onSelectNode: (nodeId: string) => void;
  onReturnLive: () => void;
  onToggleTutor: () => void;
  className?: string;
};

const COL_W = 72;
const LANE_H = 40;
const NODE_R = 6;
const LABEL_H = 24;

function nodeLabel(node: TimelineGraphNode): string {
  if (node.isOverflow) return node.san ?? "+";
  if (!node.san) return "start";
  return node.san;
}

function ariaLabelFor(node: TimelineGraphNode): string {
  const parts = [node.san ? nodeLabel(node) : "Start"];
  if (node.kind === "projected") parts.push("projected future");
  if (node.kind === "tutor") parts.push("tutor line");
  if (node.kind === "variation") parts.push("variation");
  if (node.isLive) parts.push("live position");
  if (node.isReview) parts.push("selected");
  if (node.isOverflow) parts.push(`${node.overflowCount ?? 0} more branches`);
  return parts.join(", ");
}

/**
 * Horizontal branching timeline (GitHub-network style) with transport controls.
 * Review selection is ephemeral — clicking does not mutate the live game tree.
 */
export function MoveTimeline({
  tree,
  reviewNodeId,
  futureLine = null,
  tutorLine = null,
  disabled = false,
  tutorOpen = false,
  canOpenTutor = false,
  onSelectNode,
  onReturnLive,
  onToggleTutor,
  className,
}: MoveTimelineProps) {
  const graph = useMemo(
    () =>
      buildBranchGraph({
        tree,
        reviewNodeId,
        futureLine,
        tutorLine,
      }),
    [tree, reviewNodeId, futureLine, tutorLine],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedId = reviewNodeId ?? tree.currentNodeId;
  const isReviewing = reviewNodeId != null && reviewNodeId !== tree.currentNodeId;

  const sorted = graph.nodes;
  const laneCount = Math.max(1, graph.maxLaneAbs * 2 + 1);
  // Extra bottom pad so the lowest lane's SAN label isn't clipped.
  const height = laneCount * LANE_H + LABEL_H + 20;
  const width = Math.max(graph.columns, 1) * COL_W + 24;
  const midY = (height - LABEL_H) / 2;

  useEffect(() => {
    const selected = scrollRef.current?.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(selectedId)}"]`,
    );
    selected?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    });
  }, [selectedId, graph.columns]);

  function focusRelative(deltaCol: number, deltaLane: number): void {
    const current = graph.nodes.find((n) => n.id === selectedId);
    if (!current) return;
    const targetCol = current.column + deltaCol;
    const targetLane = current.lane + deltaLane;
    let best: TimelineGraphNode | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const node of graph.nodes) {
      if (node.isOverflow) continue;
      const score =
        Math.abs(node.column - targetCol) * 10 +
        Math.abs(node.lane - targetLane);
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    }
    if (best) {
      onSelectNode(best.id);
      const el = scrollRef.current?.querySelector<HTMLButtonElement>(
        `[data-node-id="${CSS.escape(best.id)}"]`,
      );
      el?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusRelative(1, 0);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusRelative(-1, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRelative(0, 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRelative(0, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      onSelectNode(tree.rootId);
    } else if (event.key === "End") {
      event.preventDefault();
      onSelectNode(tree.currentNodeId);
    }
  }

  function step(delta: number): void {
    const main = graph.nodes
      .filter((n) => n.lane === 0 && !n.isOverflow)
      .sort((a, b) => a.column - b.column);
    const idx = main.findIndex((n) => n.id === selectedId);
    const base = idx >= 0 ? idx : main.findIndex((n) => n.isLive);
    const next = main[Math.min(main.length - 1, Math.max(0, base + delta))];
    if (next) onSelectNode(next.id);
  }

  const nodeById = useMemo(() => {
    const map = new Map<string, TimelineGraphNode>();
    for (const n of sorted) map.set(n.id, n);
    return map;
  }, [sorted]);

  return (
    <Card
      size="sm"
      className={cn(
        "w-full gap-0 rounded-none border-0 py-0 shadow-none ring-0",
        className,
      )}
      data-testid="move-timeline"
      aria-label="Move timeline"
    >
      <CardContent className="flex items-center gap-2 px-2 py-2 sm:px-3">
        <div
          ref={scrollRef}
          role="listbox"
          aria-label="Game moves"
          aria-activedescendant={`timeline-node-${selectedId}`}
          tabIndex={0}
          className="min-h-16 min-w-0 flex-1 overflow-x-auto overflow-y-hidden scroll-fade-x [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="move-list"
          onKeyDown={onKeyDown}
        >
          {tree.currentNodeId === tree.rootId ? (
            <p className="sr-only">No moves yet</p>
          ) : null}
          <div
            className="relative"
            style={{ width, height }}
            data-testid="timeline-graph"
          >
            <svg
              className="pointer-events-none absolute inset-0"
              width={width}
              height={height}
              aria-hidden
            >
              {graph.edges.map((edge) => {
                const from = nodeById.get(edge.fromId);
                const to = nodeById.get(edge.toId);
                if (!from || !to) return null;
                const x1 = from.column * COL_W + COL_W / 2;
                const y1 = midY - from.lane * LANE_H;
                const x2 = to.column * COL_W + COL_W / 2;
                const y2 = midY - to.lane * LANE_H;
                const midX = (x1 + x2) / 2;
                const dashed =
                  edge.kind === "projected" || edge.kind === "tutor";
                return (
                  <path
                    key={`${edge.fromId}->${edge.toId}`}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={edge.kind === "tutor" ? 1.75 : 1.5}
                    strokeDasharray={dashed ? "4 3" : undefined}
                    className={
                      edge.kind === "tutor"
                        ? "stroke-primary/70"
                        : edge.kind === "projected"
                          ? "stroke-muted-foreground/45"
                          : undefined
                    }
                  />
                );
              })}
            </svg>

            {sorted.map((node) => {
              const cx = node.column * COL_W + COL_W / 2;
              const cy = midY - node.lane * LANE_H;
              const hollow =
                node.kind === "projected" || node.kind === "tutor";
              const selected =
                node.isReview || (!reviewNodeId && node.isLive);
              const button = (
                <button
                  type="button"
                  id={`timeline-node-${node.id}`}
                  role="option"
                  aria-selected={selected}
                  aria-label={ariaLabelFor(node)}
                  data-timeline-node="true"
                  data-node-id={node.id}
                  data-kind={node.kind}
                  data-variation={
                    node.kind === "variation" || node.kind === "tutor"
                      ? "true"
                      : "false"
                  }
                  data-testid={`timeline-node-${node.ply}`}
                  disabled={disabled || node.isOverflow}
                  className={cn(
                    "absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "touch-manipulation",
                    selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                  style={{ left: cx, top: cy }}
                  onClick={() => {
                    if (!node.isOverflow) onSelectNode(node.id);
                  }}
                >
                  <span
                    className={cn(
                      "size-3 rounded-full border-2",
                      hollow
                        ? "border-muted-foreground bg-background"
                        : "border-foreground bg-foreground",
                      node.kind === "tutor" && "border-primary",
                      node.isLive &&
                        "after:absolute after:top-[calc(50%+10px)] after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                    )}
                    aria-hidden
                  />
                  <span className="sr-only">{ariaLabelFor(node)}</span>
                </button>
              );

              return (
                <div key={node.id}>
                  <HoverCard>
                    <HoverCardTrigger render={button} />
                    {!node.isOverflow ? (
                      <HoverCardContent className="w-auto p-2" side="top">
                        <BoardPreview fen={node.fen} san={node.san} />
                      </HoverCardContent>
                    ) : null}
                  </HoverCard>
                  <span
                    className="pointer-events-none absolute text-center font-mono text-[0.7rem] leading-tight text-muted-foreground"
                    style={{
                      left: node.column * COL_W + 4,
                      top: cy + NODE_R + 8,
                      width: COL_W - 8,
                    }}
                  >
                    {nodeLabel(node)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-0.5 border-l border-border pl-2"
          data-testid="timeline-transport"
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={disabled}
                  aria-label="Go to start"
                  data-testid="timeline-first"
                  onClick={() => onSelectNode(tree.rootId)}
                />
              }
            >
              <RiSkipBackLine />
            </TooltipTrigger>
            <TooltipContent>Start</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={disabled}
                  aria-label="Previous move"
                  data-testid="timeline-prev"
                  onClick={() => step(-1)}
                />
              }
            >
              <RiArrowLeftLine />
            </TooltipTrigger>
            <TooltipContent>Previous</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  disabled={disabled}
                  aria-label="Next move"
                  data-testid="timeline-next"
                  onClick={() => step(1)}
                />
              }
            >
              <RiArrowRightLine />
            </TooltipTrigger>
            <TooltipContent>Next</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-xs"
                  variant={isReviewing ? "default" : "ghost"}
                  disabled={disabled || !isReviewing}
                  aria-label="Return to live position"
                  data-testid="timeline-live"
                  onClick={onReturnLive}
                />
              }
            >
              <RiSkipForwardLine />
            </TooltipTrigger>
            <TooltipContent>Live</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-0.5 data-vertical:h-5 data-vertical:self-auto" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-xs"
                  variant={tutorOpen ? "secondary" : "ghost"}
                  disabled={!canOpenTutor}
                  aria-label="Toggle tutor thoughts"
                  aria-pressed={tutorOpen}
                  data-testid="toggle-teaching-card"
                  onClick={onToggleTutor}
                />
              }
            >
              <RiChat3Line />
            </TooltipTrigger>
            <TooltipContent>Tutor</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

/** @deprecated Kept for unit tests that still import the list builder. */
export {
  buildTimelineEntries,
  type TimelineEntry,
} from "@/components/timeline/move-timeline-legacy";
