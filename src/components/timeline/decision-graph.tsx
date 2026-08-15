"use client";

import { useState } from "react";
import type { DecisionGraph } from "@/components/timeline/decision-types";
import {
  COL_W,
  graphCaptionTop,
  graphContentHeight,
  graphLabelTop,
  graphNodeCenter,
  NODE_CAPTION_H,
  NODE_LABEL_H,
} from "@/components/timeline/tree-layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PruneScope } from "@/domain/game";
import { cn } from "@/lib/utils";

export type DecisionGraphViewProps = {
  graph: DecisionGraph;
  focusedNodeId: string;
  disabled?: boolean;
  onSelectNode: (nodeId: string) => void;
  onOpenCoach?: () => void;
  pruneMode?: boolean;
  onPruneTarget?: (
    nodeId: string,
    scope: PruneScope,
    removalCount: number,
    san: string,
  ) => void;
};

function moverLabel(node: DecisionGraph["nodes"][number]): string | null {
  if (node.moveColor === "w") return `White: ${node.san || node.moveLabel}`;
  if (node.moveColor === "b") return `Black: ${node.san || node.moveLabel}`;
  return null;
}

function ariaLabelFor(node: DecisionGraph["nodes"][number]): string {
  const parts: string[] = [];
  if (node.caption) parts.push(node.caption);
  const mover = moverLabel(node);
  if (mover) parts.push(mover);
  else if (node.moveLabel) parts.push(node.moveLabel);
  if (node.kind === "suggested") parts.push("Gator's suggested move");
  if (node.isCurrent) parts.push("current position");
  return parts.join(", ");
}

function nodeSan(node: DecisionGraph["nodes"][number]): string {
  return node.san || node.moveLabel;
}

function tooltipFor(node: DecisionGraph["nodes"][number]): string {
  if (node.kind === "suggested") {
    return "Gator's suggested move — click to try it";
  }
  if (node.isCurrent) return "Current position";
  return ariaLabelFor(node);
}

function pruneSan(node: DecisionGraph["nodes"][number] | undefined): string {
  if (!node) return "the start";
  return node.san || node.moveLabel || "the start";
}

function childIdsByParent(graph: DecisionGraph): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.kind === "suggested") continue;
    const list = children.get(edge.fromId) ?? [];
    list.push(edge.toId);
    children.set(edge.fromId, list);
  }
  return children;
}

function descendantIds(
  children: Map<string, string[]>,
  nodeId: string,
): string[] {
  const ids: string[] = [];
  const visited = new Set<string>([nodeId]);
  const queue = [...(children.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    ids.push(id);
    queue.push(...(children.get(id) ?? []));
  }
  return ids;
}

function removalIds(
  children: Map<string, string[]>,
  target: { nodeId: string; scope: PruneScope } | null,
): Set<string> {
  if (!target) return new Set();
  const kids = descendantIds(children, target.nodeId);
  return new Set(target.scope === "branch" ? [target.nodeId, ...kids] : kids);
}

function NodeGlyph({ node }: { node: DecisionGraph["nodes"][number] }) {
  if (node.kind === "suggested") {
    return (
      <span
        className="size-2.5 rounded-full border-2 border-dashed border-primary bg-background"
        aria-hidden
      />
    );
  }
  if (!node.moveColor) {
    return (
      <span
        className="size-2.5 rounded-full border-2 border-foreground bg-foreground"
        aria-hidden
      />
    );
  }
  return (
    <span
      className={cn(
        "size-2.5 rounded-full border-2",
        node.moveColor === "w"
          ? "border-neutral-800 bg-white"
          : "border-neutral-200 bg-neutral-900",
      )}
      aria-hidden
    />
  );
}

/**
 * Git-style tree of committed moves plus a dotted Gator suggestion.
 */
export function DecisionGraphView({
  graph,
  focusedNodeId,
  disabled = false,
  onSelectNode,
  onOpenCoach,
  pruneMode = false,
  onPruneTarget,
}: DecisionGraphViewProps) {
  const [hoverTarget, setHoverTarget] = useState<{
    nodeId: string;
    scope: PruneScope;
  } | null>(null);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const children = childIdsByParent(graph);
  const highlighted = pruneMode
    ? removalIds(children, hoverTarget)
    : new Set<string>();
  const width = Math.max(graph.columns, 1) * COL_W;
  const height = graphContentHeight(graph.minLane, graph.maxLane);

  return (
    <div
      className="relative"
      style={{ width, height }}
      data-testid="timeline-graph"
      data-prune-mode={pruneMode ? "true" : "false"}
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
          const a = graphNodeCenter(from.column, from.lane, graph.maxLane);
          const b = graphNodeCenter(to.column, to.lane, graph.maxLane);
          const midX = (a.cx + b.cx) / 2;
          const suggested = edge.kind === "suggested";
          const marked = highlighted.has(edge.toId);
          const d = `M ${a.cx} ${a.cy} C ${midX} ${a.cy}, ${midX} ${b.cy}, ${b.cx} ${b.cy}`;
          return (
            <g key={`${edge.fromId}->${edge.toId}`}>
              <path
                d={d}
                fill="none"
                stroke="var(--border)"
                strokeWidth={suggested ? 1.75 : 1.5}
                strokeDasharray={suggested ? "4 3" : undefined}
                className={
                  marked
                    ? "stroke-destructive"
                    : suggested
                      ? "stroke-primary/70"
                      : undefined
                }
                data-prune-target={marked ? "true" : undefined}
              />
              {pruneMode && !suggested ? (
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={10}
                  className="pointer-events-auto cursor-crosshair"
                  data-timeline-edge="true"
                  data-from-id={edge.fromId}
                  data-to-id={edge.toId}
                  data-testid={`timeline-edge-${edge.fromId}-${edge.toId}`}
                  onPointerEnter={() => {
                    setHoverTarget({ nodeId: edge.toId, scope: "branch" });
                  }}
                  onPointerLeave={() => {
                    setHoverTarget(null);
                  }}
                  onClick={() => {
                    const count = 1 + descendantIds(children, edge.toId).length;
                    onPruneTarget?.(edge.toId, "branch", count, pruneSan(from));
                  }}
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      {graph.nodes.map((node) => {
        const { cx, cy } = graphNodeCenter(
          node.column,
          node.lane,
          graph.maxLane,
        );
        const selected = node.id === focusedNodeId;
        const caption = node.caption;
        const childCount = descendantIds(children, node.id).length;
        const canPrune =
          pruneMode && node.kind === "committed" && childCount > 0;
        const marked = highlighted.has(node.id);
        return (
          <div key={node.id}>
            {caption ? (
              <span
                className={cn(
                  "pointer-events-none absolute truncate text-center text-[0.6rem] leading-none",
                  node.kind === "suggested"
                    ? "text-primary"
                    : "text-muted-foreground",
                  marked && "text-destructive",
                )}
                style={{
                  left: node.column * COL_W + 2,
                  top: graphCaptionTop(cy),
                  width: COL_W - 4,
                  height: NODE_CAPTION_H,
                }}
              >
                {caption}
              </span>
            ) : null}
            <Tooltip>
              <TooltipTrigger
                render={
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
                    data-testid={`timeline-node-${node.id}`}
                    data-prune-target={marked ? "true" : undefined}
                    disabled={disabled}
                    className={cn(
                      "group absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full sm:size-9",
                      "bg-transparent",
                      "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "touch-manipulation",
                      pruneMode &&
                        (canPrune ? "cursor-crosshair" : "cursor-not-allowed"),
                    )}
                    style={{ left: cx, top: cy }}
                    onPointerEnter={() => {
                      if (!canPrune) return;
                      setHoverTarget({
                        nodeId: node.id,
                        scope: "descendants",
                      });
                    }}
                    onPointerLeave={() => {
                      if (pruneMode) setHoverTarget(null);
                    }}
                    onClick={() => {
                      if (pruneMode) {
                        if (!canPrune) return;
                        onPruneTarget?.(
                          node.id,
                          "descendants",
                          childCount,
                          pruneSan(node),
                        );
                        return;
                      }
                      onSelectNode(node.id);
                      if (node.kind === "suggested") {
                        onOpenCoach?.();
                      }
                    }}
                  />
                }
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    marked && "ring-2 ring-destructive opacity-50",
                    !marked && selected && "ring-2 ring-primary",
                    !marked &&
                      node.isCurrent &&
                      !selected &&
                      "ring-2 ring-primary/55",
                    !marked &&
                      !selected &&
                      !pruneMode &&
                      "group-hover:ring-1 group-hover:ring-foreground/30",
                  )}
                >
                  <NodeGlyph node={node} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {pruneMode
                  ? canPrune
                    ? `Remove ${childCount} ${childCount === 1 ? "move" : "moves"} after ${pruneSan(node)}`
                    : node.kind === "suggested"
                      ? "Suggested moves cannot be pruned"
                      : "Nothing to prune here"
                  : tooltipFor(node)}
              </TooltipContent>
            </Tooltip>
            <span
              className={cn(
                "pointer-events-none absolute truncate text-center font-mono text-[0.65rem] leading-none tabular-nums text-muted-foreground",
                node.kind === "suggested" && "text-primary",
                marked && "text-destructive",
              )}
              style={{
                left: node.column * COL_W + 4,
                top: graphLabelTop(cy),
                width: COL_W - 8,
                height: NODE_LABEL_H,
              }}
            >
              {nodeSan(node)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
