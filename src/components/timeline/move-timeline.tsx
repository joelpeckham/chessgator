"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  laneRoleLabel,
  type TimelineGraph,
  type TimelineGraphNode,
  type TimelineLaneRole,
  transportStep,
} from "@/components/timeline/branch-graph";
import { BranchPicker } from "@/components/timeline/branch-picker";
import {
  COL_W,
  LABEL_H,
  LANE_H,
  LANE_LABEL_W,
  TIMELINE_GRAPH_HEIGHT_PX,
} from "@/components/timeline/timeline-layout";
import { nodeCenter, TimelineNode } from "@/components/timeline/timeline-node";
import { TimelineTransport } from "@/components/timeline/timeline-transport";
import { Card, CardContent } from "@/components/ui/card";
import type { GameTree } from "@/domain/game";
import { cn } from "@/lib/utils";

export type MoveTimelineProps = {
  tree: GameTree;
  graph: TimelineGraph;
  reviewNodeId: string | null;
  disabled?: boolean;
  expandedOverflowKeys?: readonly string[];
  onExpandedOverflowChange?: (keys: readonly string[]) => void;
  /** Narrow layout: fewer variation lanes, hide unused lane labels. */
  compact?: boolean;
  onSelectNode: (nodeId: string) => void;
  onReturnLive: () => void;
  /** Selecting a coach-lane node can open the coach rail. */
  onOpenCoach?: () => void;
  className?: string;
};

export {
  TIMELINE_GRAPH_HEIGHT_PX,
  TIMELINE_GRAPH_MAX_LANES,
} from "@/components/timeline/timeline-layout";

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
  graph,
  reviewNodeId,
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedId = reviewNodeId ?? tree.currentNodeId;
  const isReviewing =
    reviewNodeId != null && reviewNodeId !== tree.currentNodeId;

  const sorted = graph.nodes;
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

  const overflowById = new Map(
    graph.overflowGroups.map((g) => [g.id, g] as const),
  );
  const nodeById = new Map(sorted.map((n) => [n.id, n]));
  const activeLaneRoles = new Set<TimelineLaneRole>();
  for (const n of graph.nodes) {
    if (!n.isOverflow) activeLaneRoles.add(n.laneRole);
  }

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
      .toSorted((a, b) => b.lane - a.lane);
    if (siblings.length === 0) return;
    const idx = siblings.findIndex((n) => n.id === selectedId);
    const next =
      siblings[
        Math.min(
          siblings.length - 1,
          Math.max(0, idx + (deltaLane > 0 ? -1 : 1)),
        )
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
      step(1);
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
      return (
        activeLaneRoles.has("variationA") || activeLaneRoles.has("overflow")
      );
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
                const a = nodeCenter(from, midY);
                const b = nodeCenter(to, midY);
                const midX = (a.cx + b.cx) / 2;
                const dashed =
                  edge.kind === "projected" || edge.kind === "tutor";
                const onReview = from.isOnReviewPath && to.isOnReviewPath;
                const dimmed = isReviewing && !onReview;
                return (
                  <path
                    key={`${edge.fromId}->${edge.toId}`}
                    d={`M ${a.cx} ${a.cy} C ${midX} ${a.cy}, ${midX} ${b.cy}, ${b.cx} ${b.cy}`}
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
              const { cx, cy } = nodeCenter(node, midY);
              const selected = node.isReview || (!reviewNodeId && node.isLive);
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
                          const parentPrefix = `var:${group.parentId}:`;
                          return !k.startsWith(parentPrefix);
                        }),
                        branchKey,
                      ];
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

              return (
                <TimelineNode
                  key={node.id}
                  node={node}
                  cx={cx}
                  cy={cy}
                  selected={selected}
                  dimmed={dimmed}
                  disabled={disabled}
                  onSelect={(picked) => {
                    onSelectNode(picked.id);
                    if (picked.kind === "tutor") onOpenCoach?.();
                  }}
                />
              );
            })}
          </div>
        </div>

        <TimelineTransport
          disabled={disabled}
          isReviewing={isReviewing}
          onFirst={() => onSelectNode(tree.rootId)}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onLive={onReturnLive}
        />
      </CardContent>
    </Card>
  );
}
