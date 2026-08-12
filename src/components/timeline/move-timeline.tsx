"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { BoardPreview } from "@/components/board/board-preview";
import {
  buildBranchGraph,
  laneRoleLabel,
  transportStep,
  type TimelineGraphNode,
  type TimelineLaneRole,
} from "@/components/timeline/branch-graph";
import { BranchPicker } from "@/components/timeline/branch-picker";
import type { ProjectedLine } from "@/domain/analysis";
import type { GameTree } from "@/domain/game";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@remixicon/react";

export type MoveTimelineProps = {
  tree: GameTree;
  reviewNodeId: string | null;
  futureLine?: ProjectedLine | null;
  tutorLine?: ProjectedLine | null;
  disabled?: boolean;
  expandedOverflowKeys?: readonly string[];
  onExpandedOverflowChange?: (keys: readonly string[]) => void;
  /** Narrow layout: fewer variation lanes, hide engine when coach is present. */
  compact?: boolean;
  onSelectNode: (nodeId: string) => void;
  onReturnLive: () => void;
  /** Selecting a coach-lane node can open the coach rail. */
  onOpenCoach?: () => void;
  className?: string;
};

const COL_W = 72;
const LANE_H = 36;
const NODE_R = 6;
const LABEL_H = 22;
const LANE_LABEL_W = 72;
/** Fixed graph height for maxLaneSide=2 (5 lanes) so board size never shifts. */
export const TIMELINE_GRAPH_MAX_LANES = 5;
export const TIMELINE_GRAPH_HEIGHT_PX =
  TIMELINE_GRAPH_MAX_LANES * LANE_H + LABEL_H + 20;

function ariaLabelFor(node: TimelineGraphNode): string {
  const parts = [node.moveLabel];
  if (node.kind === "projected") parts.push("engine line");
  if (node.kind === "tutor") parts.push("coach line");
  if (node.kind === "variation") parts.push("variation");
  if (node.isLive) parts.push("live position");
  if (node.isReview) parts.push("selected");
  if (node.isOverflow) parts.push(`${node.overflowCount ?? 0} more branches`);
  if (node.isTruncated) parts.push("truncated");
  return parts.join(", ");
}

function NodeGlyph({ node }: { node: TimelineGraphNode }) {
  const hollow = node.kind === "projected" || node.kind === "tutor";
  if (node.kind === "tutor") {
    return (
      <span
        className="size-2.5 rotate-45 border-2 border-primary bg-background"
        aria-hidden
      />
    );
  }
  return (
    <span
      className={cn(
        "size-3 rounded-full border-2",
        hollow
          ? "border-muted-foreground bg-background"
          : "border-foreground bg-foreground",
        node.laneRole === "variationA" || node.laneRole === "variationB"
          ? "opacity-80"
          : null,
      )}
      aria-hidden
    />
  );
}

function statusLineText(args: {
  isReviewing: boolean;
  selected: TimelineGraphNode | undefined;
  livePly: number;
}): string {
  const { isReviewing, selected, livePly } = args;
  if (!isReviewing) {
    const move = Math.max(0, Math.floor((livePly + 1) / 2));
    return move === 0 ? "Live · start" : `Live · move ${move}`;
  }
  if (!selected) return "Reviewing";
  if (selected.kind === "tutor") {
    return `Reviewing coach idea · ${selected.moveLabel}`;
  }
  if (selected.kind === "projected") {
    return `Reviewing engine line · ${selected.moveLabel}`;
  }
  if (!selected.isOnPlayedPath) {
    return `Reviewing variation · ${selected.moveLabel}`;
  }
  return `Reviewing · ${selected.moveLabel}`;
}

/**
 * Horizontal branching timeline with semantic lanes and transport controls.
 * Review selection is ephemeral — clicking does not mutate the live game tree.
 */
export function MoveTimeline({
  tree,
  reviewNodeId,
  futureLine = null,
  tutorLine = null,
  disabled = false,
  expandedOverflowKeys: controlledKeys,
  onExpandedOverflowChange,
  compact = false,
  onSelectNode,
  onReturnLive,
  onOpenCoach,
  className,
}: MoveTimelineProps) {
  const [localKeys, setLocalKeys] = useState<string[]>([]);
  const expandedOverflowKeys = controlledKeys ?? localKeys;

  function setExpandedKeys(keys: string[]): void {
    if (onExpandedOverflowChange) onExpandedOverflowChange(keys);
    else setLocalKeys(keys);
  }

  const maxLaneSide = compact ? 1 : 2;
  const showCoachLine = Boolean(tutorLine);
  // On compact layouts, hide engine when coach context is active.
  const showEngineLine = compact ? !showCoachLine : true;

  const graph = useMemo(
    () =>
      buildBranchGraph({
        tree,
        reviewNodeId,
        futureLine,
        tutorLine,
        expandedOverflowKeys,
        maxLaneSide,
        showEngineLine,
        showCoachLine,
      }),
    [
      tree,
      reviewNodeId,
      futureLine,
      tutorLine,
      expandedOverflowKeys,
      maxLaneSide,
      showEngineLine,
      showCoachLine,
    ],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedId = reviewNodeId ?? tree.currentNodeId;
  const isReviewing =
    reviewNodeId != null && reviewNodeId !== tree.currentNodeId;

  const sorted = graph.nodes;
  // Always reserve max desktop lane height so board size stays stable.
  const height = TIMELINE_GRAPH_HEIGHT_PX;
  const width = Math.max(graph.columns, 1) * COL_W + 24;
  const midY = (height - LABEL_H) / 2;

  const selectedNode = graph.nodes.find((n) => n.id === selectedId);
  const liveNode = graph.nodes.find((n) => n.isLive);
  const statusText = statusLineText({
    isReviewing,
    selected: selectedNode,
    livePly: liveNode?.ply ?? 0,
  });

  const overflowById = useMemo(() => {
    const map = new Map(
      graph.overflowGroups.map((g) => [g.id, g] as const),
    );
    return map;
  }, [graph.overflowGroups]);

  const activeLaneRoles = useMemo(() => {
    const roles = new Set<TimelineLaneRole>();
    for (const n of graph.nodes) {
      if (!n.isOverflow) roles.add(n.laneRole);
    }
    return roles;
  }, [graph.nodes]);

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

  function focusSibling(deltaLane: number): void {
    const current = graph.nodes.find((n) => n.id === selectedId);
    if (!current) return;
    const siblings = graph.nodes
      .filter(
        (n) =>
          n.column === current.column &&
          !n.isOverflow &&
          (n.parentId === current.parentId || n.lane === 0),
      )
      .sort((a, b) => b.lane - a.lane);
    if (siblings.length === 0) return;
    const idx = siblings.findIndex((n) => n.id === selectedId);
    const next =
      siblings[
        Math.min(siblings.length - 1, Math.max(0, idx + (deltaLane > 0 ? -1 : 1)))
      ];
    if (next) {
      onSelectNode(next.id);
      if (next.kind === "tutor") onOpenCoach?.();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = transportStep(graph, selectedId, 1);
      if (next) {
        onSelectNode(next);
        const node = graph.nodes.find((n) => n.id === next);
        if (node?.kind === "tutor") onOpenCoach?.();
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = transportStep(graph, selectedId, -1);
      if (prev) onSelectNode(prev);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusSibling(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusSibling(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      onSelectNode(tree.rootId);
    } else if (event.key === "End") {
      event.preventDefault();
      onSelectNode(tree.currentNodeId);
    }
  }

  function step(delta: -1 | 1): void {
    const next = transportStep(graph, selectedId, delta);
    if (next) {
      onSelectNode(next);
      const node = graph.nodes.find((n) => n.id === next);
      if (node?.kind === "tutor") onOpenCoach?.();
    }
  }

  const nodeById = useMemo(() => {
    const map = new Map<string, TimelineGraphNode>();
    for (const n of sorted) map.set(n.id, n);
    return map;
  }, [sorted]);

  const laneLabelRows: Array<{ role: TimelineLaneRole; lane: number }> = (
    [
      { role: "coach" as const, lane: 1 },
      { role: "variationA" as const, lane: 2 },
      { role: "played" as const, lane: 0 },
      { role: "variationB" as const, lane: -2 },
      { role: "engine" as const, lane: -1 },
    ] satisfies Array<{ role: TimelineLaneRole; lane: number }>
  ).filter((row) => {
    if (row.role === "played") return true;
    if (compact && (row.role === "variationA" || row.role === "variationB")) {
      return activeLaneRoles.has("variationA") || activeLaneRoles.has("overflow");
    }
    return activeLaneRoles.has(row.role);
  });

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
      <div
        className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-1 sm:px-3"
        data-testid="timeline-status"
      >
        <p className="truncate text-xs text-muted-foreground">{statusText}</p>
        <div
          className="hidden items-center gap-2 text-[0.65rem] text-muted-foreground sm:flex"
          data-testid="timeline-legend"
          aria-hidden
        >
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-foreground" />
            Played
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rotate-45 border border-primary bg-background" />
            Coach
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full border border-muted-foreground bg-background" />
            Engine
          </span>
        </div>
      </div>
      <CardContent className="flex items-stretch gap-2 px-2 py-2 sm:px-3">
        {/* Sticky lane labels */}
        <div
          className="relative hidden w-[4.5rem] shrink-0 sm:block"
          style={{ height }}
          data-testid="timeline-lane-labels"
          aria-hidden
        >
          {laneLabelRows.map((row) => (
            <span
              key={row.role}
              className="absolute right-1 -translate-y-1/2 text-[0.65rem] leading-none text-muted-foreground"
              style={{ top: midY - row.lane * LANE_H, width: LANE_LABEL_W - 8 }}
            >
              {laneRoleLabel(row.role)}
            </span>
          ))}
        </div>

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
          <p className="sr-only">
            Scroll for more moves. Arrow keys move along the selected branch.
          </p>
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
                const onReview =
                  from.isOnReviewPath && to.isOnReviewPath;
                const dimmed = isReviewing && !onReview;
                return (
                  <path
                    key={`${edge.fromId}->${edge.toId}`}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={edge.kind === "tutor" ? 1.75 : 1.5}
                    strokeDasharray={
                      edge.kind === "projected"
                        ? "2 3"
                        : dashed
                          ? "4 3"
                          : undefined
                    }
                    className={cn(
                      edge.kind === "tutor"
                        ? "stroke-primary/70"
                        : edge.kind === "projected"
                          ? "stroke-muted-foreground/45"
                          : undefined,
                      dimmed && "opacity-40",
                    )}
                  />
                );
              })}
            </svg>

            {sorted.map((node) => {
              const cx = node.column * COL_W + COL_W / 2;
              const cy = midY - node.lane * LANE_H;
              const selected =
                node.isReview || (!reviewNodeId && node.isLive);
              const dimmed =
                isReviewing && !node.isOnReviewPath && !node.isOverflow;

              if (node.isOverflow && node.overflowGroupId) {
                const group = overflowById.get(node.overflowGroupId);
                if (!group) return null;
                return (
                  <BranchPicker
                    key={node.id}
                    group={group}
                    disabled={disabled}
                    style={{ left: cx, top: cy }}
                    className={cn(dimmed && "opacity-40")}
                    onSelectBranch={(branchKey, headNodeId) => {
                      const next = [
                        ...expandedOverflowKeys.filter((k) => {
                          // Displace only siblings from the same parent group.
                          const parentPrefix = `var:${group.parentId}:`;
                          return !k.startsWith(parentPrefix);
                        }),
                        branchKey,
                      ];
                      // Keep at most maxLaneSide pins for this parent.
                      const parentPins = next.filter((k) =>
                        k.startsWith(`var:${group.parentId}:`),
                      );
                      const others = next.filter(
                        (k) => !k.startsWith(`var:${group.parentId}:`),
                      );
                      setExpandedKeys([
                        ...others,
                        ...parentPins.slice(-maxLaneSide),
                      ]);
                      onSelectNode(headNodeId);
                    }}
                  />
                );
              }

              const button = (
                <button
                  type="button"
                  id={`timeline-node-${node.id}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={selected}
                  aria-label={ariaLabelFor(node)}
                  data-timeline-node="true"
                  data-node-id={node.id}
                  data-kind={node.kind}
                  data-lane={node.lane}
                  data-branch-key={node.branchKey}
                  data-variation={
                    node.kind === "variation" || node.kind === "tutor"
                      ? "true"
                      : "false"
                  }
                  data-testid={`timeline-node-${node.id}`}
                  disabled={disabled}
                  className={cn(
                    "absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full sm:size-7",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "touch-manipulation",
                    selected &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    dimmed && "opacity-40",
                  )}
                  style={{ left: cx, top: cy }}
                  onClick={() => {
                    onSelectNode(node.id);
                    if (node.kind === "tutor") onOpenCoach?.();
                  }}
                >
                  <NodeGlyph node={node} />
                  {node.isLive ? (
                    <span
                      className="absolute top-[calc(50%+11px)] left-1/2 -translate-x-1/2 rounded-sm bg-primary px-1 font-mono text-[0.55rem] leading-tight text-primary-foreground"
                      aria-hidden
                    >
                      Live
                    </span>
                  ) : null}
                </button>
              );

              return (
                <div key={node.id}>
                  <HoverCard>
                    <HoverCardTrigger render={button} />
                    <HoverCardContent className="w-auto p-2" side="top">
                      <BoardPreview fen={node.fen} san={node.san} />
                    </HoverCardContent>
                  </HoverCard>
                  <span
                    className={cn(
                      "pointer-events-none absolute text-center font-mono text-[0.7rem] leading-tight text-muted-foreground",
                      dimmed && "opacity-40",
                      node.kind === "projected" && "opacity-70",
                    )}
                    style={{
                      left: node.column * COL_W + 4,
                      top: cy + NODE_R + (node.isLive ? 14 : 8),
                      width: COL_W - 8,
                    }}
                  >
                    {node.kind === "projected" ? `~${node.san}` : node.moveLabel}
                    {node.isTruncated ? "…" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-border pl-2"
          data-testid="timeline-transport"
        >
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="size-11 sm:size-7"
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
                    className="size-11 sm:size-7"
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
                    className="size-11 sm:size-7"
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
                    className="size-11 sm:size-7"
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
          </div>
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
