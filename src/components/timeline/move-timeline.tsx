"use client";

import { type KeyboardEvent, useEffect, useRef } from "react";
import { DecisionGraphView } from "@/components/timeline/decision-graph";
import {
  stepForkLane,
  transportStep,
} from "@/components/timeline/decision-graph-nav";
import type { DecisionGraph } from "@/components/timeline/decision-types";
import {
  PRACTICE_BAR_H,
  STATUS_ROW_H,
  TIMELINE_GRAPH_HEIGHT_PX,
} from "@/components/timeline/timeline-layout";
import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";
import { cn } from "@/lib/utils";

export type TimelineSelectMeta = {
  branchId: string;
  decisionId: string | null;
};

export type MoveTimelineProps = {
  graph: DecisionGraph;
  focusedNodeId: string;
  startNodeId: string;
  liveNodeId: string;
  mode: "live" | "review" | "practice";
  statusText: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  prevNodeId: string | null;
  nextNodeId: string | null;
  canPracticeUndo: boolean;
  canPracticeRedo: boolean;
  canCommitPractice: boolean;
  canTakeBackLive: boolean;
  disabled?: boolean;
  orientation?: "white" | "black";
  onSelectDecision: (decisionId: string, meta?: TimelineSelectMeta) => void;
  onSelectNode: (nodeId: string, meta?: TimelineSelectMeta) => void;
  onPreviewNode?: (nodeId: string | null) => void;
  onReturnLive: () => void;
  onOpenCoach?: () => void;
  onPracticeUndo?: () => void;
  onPracticeRedo?: () => void;
  onCommitPractice?: () => void;
  onCancelPractice?: () => void;
  onTakeBackLive?: () => void;
  className?: string;
};

export { TIMELINE_GRAPH_HEIGHT_PX } from "@/components/timeline/timeline-layout";

function metaFor(
  graph: DecisionGraph,
  nodeId: string,
): TimelineSelectMeta | undefined {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) return undefined;
  return { branchId: node.branchId, decisionId: node.decisionId };
}

/**
 * Git-style decision trail: live-path trunk with local forks at the
 * focused decision. Practice controls stay in this chrome.
 */
export function MoveTimeline({
  graph,
  focusedNodeId,
  startNodeId,
  liveNodeId,
  mode,
  statusText,
  canGoPrev,
  canGoNext,
  prevNodeId,
  nextNodeId,
  canPracticeUndo,
  canPracticeRedo,
  canCommitPractice,
  canTakeBackLive,
  disabled = false,
  orientation = "white",
  onSelectDecision,
  onSelectNode,
  onPreviewNode,
  onReturnLive,
  onOpenCoach,
  onPracticeUndo,
  onPracticeRedo,
  onCommitPractice,
  onCancelPractice,
  onTakeBackLive,
  className,
}: MoveTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewingLive = mode === "live";
  const hasMoves = graph.nodes.some(
    (node) => node.kind === "committed" && node.id !== startNodeId,
  );

  useEffect(() => {
    const selected = scrollRef.current?.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(focusedNodeId)}"]`,
    );
    const reduceMotion = prefersReducedMotion();
    selected?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [focusedNodeId, graph.nodes.length]);

  function selectId(nodeId: string): void {
    onSelectNode(nodeId, metaFor(graph, nodeId));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    const pinned = graph.nodes.find(
      (node) => node.id === focusedNodeId,
    )?.branchId;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextId = transportStep(graph, focusedNodeId, 1, pinned);
      if (nextId) selectId(nextId);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const nextId = transportStep(graph, focusedNodeId, -1, pinned);
      if (nextId) selectId(nextId);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextId = stepForkLane(graph, focusedNodeId, 1);
      if (nextId) selectId(nextId);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextId = stepForkLane(graph, focusedNodeId, -1);
      if (nextId) selectId(nextId);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectId(startNodeId);
    } else if (event.key === "End") {
      event.preventDefault();
      if (mode === "practice") {
        selectId(liveNodeId);
        return;
      }
      onReturnLive();
    }
  }

  return (
    <section
      className={cn("flex w-full flex-col", className)}
      data-testid="move-timeline"
      aria-label="Move timeline"
      style={{ height: TIMELINE_GRAPH_HEIGHT_PX }}
    >
      <div className="flex min-h-0 flex-1 items-center gap-1 px-1 sm:px-2">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          disabled={disabled || !canGoPrev || !prevNodeId}
          aria-label="Previous position"
          data-testid="timeline-prev"
          onClick={() => {
            if (prevNodeId) selectId(prevNodeId);
          }}
        >
          ‹
        </Button>
        <div
          ref={scrollRef}
          role="listbox"
          aria-label="Game moves"
          aria-activedescendant={`timeline-node-${focusedNodeId}`}
          tabIndex={0}
          className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden scroll-fade-x scrollbar-thin focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="move-list"
          onKeyDown={onKeyDown}
          onPointerLeave={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) {
              return;
            }
            onPreviewNode?.(null);
          }}
        >
          <p className="sr-only">
            Arrow keys move along the selected branch. Up and down switch
            branches at a fork. Home goes to the start. End returns to the live
            game.
          </p>
          {hasMoves ? null : <p className="sr-only">No moves yet</p>}
          <DecisionGraphView
            graph={graph}
            focusedNodeId={focusedNodeId}
            disabled={disabled}
            orientation={orientation}
            onSelectDecision={onSelectDecision}
            onSelectNode={onSelectNode}
            onPreviewNode={onPreviewNode}
            onOpenCoach={onOpenCoach}
          />
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          disabled={disabled || !canGoNext || !nextNodeId}
          aria-label="Next position"
          data-testid="timeline-next"
          onClick={() => {
            if (nextNodeId) selectId(nextNodeId);
          }}
        >
          ›
        </Button>
      </div>

      <div
        className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 px-2 sm:px-3"
        data-testid="timeline-status"
        style={{ height: STATUS_ROW_H }}
      >
        <p className="truncate text-xs text-muted-foreground">{statusText}</p>
        <div className="flex shrink-0 items-center gap-2">
          {!viewingLive && mode !== "practice" ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={disabled}
              aria-label="Return to live position"
              data-testid="timeline-live"
              onClick={onReturnLive}
            >
              Back to game
            </Button>
          ) : null}
        </div>
      </div>

      {mode === "practice" ? (
        <div
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-border/60 px-2 scrollbar-thin sm:px-3"
          data-testid="practice-controls"
          style={{ height: PRACTICE_BAR_H }}
        >
          <Button
            type="button"
            size="xs"
            variant="secondary"
            disabled={disabled || !canPracticeUndo}
            data-testid="practice-undo"
            onClick={onPracticeUndo}
          >
            Undo
          </Button>
          <Button
            type="button"
            size="xs"
            variant="secondary"
            disabled={disabled || !canPracticeRedo}
            data-testid="practice-redo"
            onClick={onPracticeRedo}
          >
            Redo
          </Button>
          {canTakeBackLive ? (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              disabled={disabled}
              data-testid="undo-human-move-button"
              onClick={onTakeBackLive}
            >
              Take back my move
            </Button>
          ) : null}
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={disabled || !canCommitPractice}
            data-testid="play-this-move-button"
            onClick={onCommitPractice}
          >
            Use this move in game
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={disabled}
            data-testid="practice-cancel"
            onClick={onCancelPractice}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div
          className="shrink-0"
          style={{ height: PRACTICE_BAR_H }}
          aria-hidden
        />
      )}
    </section>
  );
}
