"use client";

import {
  RiContractUpDownLine,
  RiExpandUpDownLine,
  RiScissorsCutLine,
} from "@remixicon/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
  type WheelEvent,
} from "react";
import { DecisionGraphView } from "@/components/timeline/decision-graph";
import type { DecisionGraph } from "@/components/timeline/decision-types";
import {
  EXPANDED_GRAPH_H,
  graphNodeCenter,
  STRIP_GRAPH_H,
  TIMELINE_EXPANDED_HEIGHT_PX,
  TIMELINE_GRAPH_HEIGHT_PX,
  verticalCenterOffset,
} from "@/components/timeline/tree-layout";
import {
  branchTipId,
  stepSiblingLane,
  transportStep,
} from "@/components/timeline/tree-nav";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { PruneScope } from "@/domain/game";
import { prefersReducedMotion } from "@/lib/prefers-reduced-motion";
import { cn } from "@/lib/utils";

export type MoveTimelineProps = {
  graph: DecisionGraph;
  focusedNodeId: string;
  startNodeId: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  prevNodeId: string | null;
  nextNodeId: string | null;
  disabled?: boolean;
  onSelectNode: (nodeId: string) => void;
  onOpenCoach?: () => void;
  onPrune?: (nodeId: string, scope: PruneScope) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  className?: string;
};

type PendingPrune = {
  nodeId: string;
  scope: PruneScope;
  count: number;
  san: string;
};

export {
  TIMELINE_EXPANDED_HEIGHT_PX,
  TIMELINE_GRAPH_HEIGHT_PX,
} from "@/components/timeline/tree-layout";

/**
 * Git-style move tree. Both heights pan; expand only shows more lanes.
 * The selected node stays vertically centered unless the user pans.
 */
export function MoveTimeline({
  graph,
  focusedNodeId,
  startNodeId,
  canGoPrev,
  canGoNext,
  prevNodeId,
  nextNodeId,
  disabled = false,
  onSelectNode,
  onOpenCoach,
  onPrune,
  expanded,
  onExpandedChange,
  className,
}: MoveTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pruneMode, setPruneMode] = useState(false);
  const [pendingPrune, setPendingPrune] = useState<PendingPrune | null>(null);
  const [panOverride, setPanOverride] = useState<{
    key: string;
    y: number;
  } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originScrollLeft: number;
    originY: number;
  } | null>(null);

  const focused = graph.nodes.find((node) => node.id === focusedNodeId);
  const viewportHeight = expanded ? EXPANDED_GRAPH_H : STRIP_GRAPH_H;
  const currentCenter = focused
    ? graphNodeCenter(focused.column, focused.lane, graph.maxLane)
    : { cx: 0, cy: viewportHeight / 2 };
  const topCy = graphNodeCenter(0, graph.maxLane, graph.maxLane).cy;
  const bottomCy = graphNodeCenter(0, graph.minLane, graph.maxLane).cy;
  const panKey = `${focusedNodeId}:${graph.nodes.length}:${expanded}`;
  const autoPanY = verticalCenterOffset(currentCenter.cy, viewportHeight);
  const userPanning = panOverride?.key === panKey;
  const panY = userPanning ? panOverride.y : autoPanY;

  function clampPanY(y: number): number {
    const maxY = viewportHeight / 2 - topCy;
    const minY = viewportHeight / 2 - bottomCy;
    return Math.min(maxY, Math.max(minY, y));
  }

  function centerFocused(smooth: boolean): void {
    const selected = scrollRef.current?.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(focusedNodeId)}"]`,
    );
    selected?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
  }

  useEffect(() => {
    const selected = scrollRef.current?.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(focusedNodeId)}"]`,
    );
    selected?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [focusedNodeId, graph.nodes.length]);

  function selectId(nodeId: string): void {
    onSelectNode(nodeId);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    if (event.key === "Escape" && pruneMode) {
      event.preventDefault();
      setPruneMode(false);
      setPendingPrune(null);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextId = transportStep(graph, focusedNodeId, 1);
      if (nextId) selectId(nextId);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const nextId = transportStep(graph, focusedNodeId, -1);
      if (nextId) selectId(nextId);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextId = stepSiblingLane(graph, focusedNodeId, 1);
      if (nextId) selectId(nextId);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextId = stepSiblingLane(graph, focusedNodeId, -1);
      if (nextId) selectId(nextId);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectId(startNodeId);
    } else if (event.key === "End") {
      event.preventDefault();
      selectId(branchTipId(graph, focusedNodeId));
    }
  }

  function onWheel(event: WheelEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaX;
    setPanOverride({
      key: panKey,
      y: clampPanY(panY - event.deltaY),
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-timeline-node], [data-timeline-edge]")
    ) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originScrollLeft: event.currentTarget.scrollLeft,
      originY: panY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.scrollLeft =
      drag.originScrollLeft - (event.clientX - drag.startX);
    setPanOverride({
      key: panKey,
      y: clampPanY(drag.originY + (event.clientY - drag.startY)),
    });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  const hasMoves = graph.nodes.some(
    (node) => node.kind === "committed" && node.id !== startNodeId,
  );

  return (
    <section
      className={cn(
        "relative flex w-full flex-col overflow-hidden border-t border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80",
        className,
      )}
      data-testid="move-timeline"
      data-expanded={expanded ? "true" : "false"}
      data-prune-mode={pruneMode ? "true" : "false"}
      aria-label="Move timeline"
      style={{
        height: expanded
          ? TIMELINE_EXPANDED_HEIGHT_PX
          : TIMELINE_GRAPH_HEIGHT_PX,
      }}
    >
      <div
        className="absolute top-2 right-2 z-10 flex items-center gap-1.5"
        data-testid="timeline-controls"
      >
        <Button
          type="button"
          size="icon-xs"
          variant="secondary"
          className="rounded-full shadow-sm"
          disabled={disabled || !canGoPrev || !prevNodeId}
          aria-label="Previous position"
          data-testid="timeline-prev"
          onClick={() => {
            if (prevNodeId) selectId(prevNodeId);
          }}
        >
          ‹
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="secondary"
          className="rounded-full shadow-sm"
          disabled={disabled || !canGoNext || !nextNodeId}
          aria-label="Next position"
          data-testid="timeline-next"
          onClick={() => {
            if (nextNodeId) selectId(nextNodeId);
          }}
        >
          ›
        </Button>
        {onPrune ? (
          <Button
            type="button"
            size="icon-xs"
            variant={pruneMode ? "default" : "secondary"}
            className="rounded-full shadow-sm"
            disabled={disabled || !hasMoves}
            aria-label={pruneMode ? "Exit prune mode" : "Prune moves"}
            aria-pressed={pruneMode}
            data-testid="timeline-prune"
            onClick={() => {
              setPruneMode((on) => !on);
              setPendingPrune(null);
            }}
          >
            <RiScissorsCutLine />
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon-xs"
          variant="secondary"
          className="rounded-full shadow-sm"
          aria-label={expanded ? "Collapse timeline" : "Expand timeline"}
          aria-pressed={expanded}
          data-testid="timeline-expand"
          onClick={() => {
            onExpandedChange(!expanded);
            requestAnimationFrame(() => centerFocused(false));
          }}
        >
          {expanded ? <RiContractUpDownLine /> : <RiExpandUpDownLine />}
        </Button>
      </div>
      <div
        ref={scrollRef}
        role="listbox"
        aria-label="Game moves"
        aria-activedescendant={`timeline-node-${focusedNodeId}`}
        tabIndex={0}
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden pr-24 select-none scrollbar-thin focus-visible:ring-2 focus-visible:ring-ring",
          pruneMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
          !expanded && "scroll-fade-x",
        )}
        data-testid="move-list"
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <p className="sr-only">
          Arrow keys move along the selected branch. Up and down switch branches
          at a fork. Home goes to the start. End goes to the end of this branch.
        </p>
        {hasMoves ? null : <p className="sr-only">No moves yet</p>}
        <div
          style={{
            transform: `translateY(${panY}px)`,
            transition:
              prefersReducedMotion() || userPanning
                ? undefined
                : "transform 280ms ease-out",
          }}
        >
          <DecisionGraphView
            graph={graph}
            focusedNodeId={focusedNodeId}
            disabled={disabled}
            onSelectNode={onSelectNode}
            onOpenCoach={onOpenCoach}
            pruneMode={pruneMode}
            onPruneTarget={(nodeId, scope, count, san) => {
              setPendingPrune({ nodeId, scope, count, san });
            }}
          />
        </div>
      </div>
      <AlertDialog
        open={pendingPrune != null}
        onOpenChange={(next) => {
          if (!next) setPendingPrune(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingPrune
                ? `Remove ${pendingPrune.count} ${pendingPrune.count === 1 ? "move" : "moves"} after ${pendingPrune.san}?`
                : "Remove moves?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Those positions will be deleted from the timeline. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirm-prune-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="confirm-prune"
              onClick={() => {
                if (!pendingPrune || !onPrune) return;
                onPrune(pendingPrune.nodeId, pendingPrune.scope);
                setPendingPrune(null);
                setPruneMode(false);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
