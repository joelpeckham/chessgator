"use client";

import { BranchPicker } from "@/components/timeline/branch-picker";
import type { DecisionGraph } from "@/components/timeline/decision-types";
import { tryBranchId } from "@/components/timeline/decision-types";
import {
  COL_W,
  GRAPH_H,
  graphCaptionTop,
  graphLabelTop,
  graphNodeCenter,
  NODE_CAPTION_H,
  NODE_LABEL_H,
} from "@/components/timeline/timeline-layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DecisionGraphViewProps = {
  graph: DecisionGraph;
  focusedNodeId: string;
  disabled?: boolean;
  orientation?: "white" | "black";
  onSelectDecision: (
    decisionId: string,
    meta?: { branchId: string; decisionId: string | null },
  ) => void;
  onSelectNode: (
    nodeId: string,
    meta?: { branchId: string; decisionId: string | null },
  ) => void;
  onPreviewNode?: (nodeId: string | null) => void;
  onOpenCoach?: () => void;
};

function ariaLabelFor(node: DecisionGraph["nodes"][number]): string {
  const parts: string[] = [];
  if (node.caption) parts.push(node.caption);
  else if (node.moveLabel) parts.push(node.moveLabel);
  if (node.kind === "tutor" && node.caption !== "Gator") {
    parts.push("Gator's idea");
  }
  if (node.kind === "variation") parts.push("saved try");
  if (node.kind === "practice") parts.push("practice line");
  if (node.kind === "projected") parts.push("engine idea");
  if (node.prominent) parts.push("coach lesson");
  if (node.isLive) parts.push("live position");
  if (node.overflowCount) parts.push(`${node.overflowCount} more tries`);
  return parts.join(", ");
}

function shortCaption(caption: string | null): string | null {
  if (caption === "Gator's idea" || caption === "Gator") return "Gator";
  if (caption === "Your move" || caption === "Current") return "Current";
  return caption;
}

function nodeSan(node: DecisionGraph["nodes"][number]): string {
  if (node.kind === "projected") return `~${node.san}`;
  return node.san || node.moveLabel;
}

function tooltipFor(node: DecisionGraph["nodes"][number]): string {
  if (node.kind === "projected") return "Likely reply (engine idea)";
  if (node.kind === "tutor") return "Gator's suggested line";
  if (node.isLive) return "Live position";
  return ariaLabelFor(node);
}

function NodeGlyph({ node }: { node: DecisionGraph["nodes"][number] }) {
  if (node.kind === "tutor") {
    return (
      <span
        className="size-2.5 rotate-45 border-2 border-primary bg-background"
        aria-hidden
      />
    );
  }
  if (node.kind === "practice") {
    return (
      <span
        className="size-2.5 rounded-sm border-2 border-primary bg-primary"
        aria-hidden
      />
    );
  }
  if (node.kind === "overflow") {
    return (
      <span
        className="flex size-6 items-center justify-center rounded-full border-2 border-muted-foreground bg-background font-mono text-[0.65rem] font-medium"
        aria-hidden
      >
        {node.san}
      </span>
    );
  }
  const hollow = node.kind === "projected";
  return (
    <span
      className={cn(
        "size-2.5 rounded-full border-2",
        hollow
          ? "border-muted-foreground bg-background"
          : node.prominent
            ? "border-primary bg-background"
            : "border-foreground bg-foreground",
      )}
      aria-hidden
    />
  );
}

/**
 * Git-style trunk plus local forks at the focused decision.
 */
export function DecisionGraphView({
  graph,
  focusedNodeId,
  disabled = false,
  orientation = "white",
  onSelectDecision,
  onSelectNode,
  onPreviewNode,
  onOpenCoach,
}: DecisionGraphViewProps) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const width = Math.max(graph.columns, 1) * COL_W;
  const height = GRAPH_H;

  return (
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
          const a = graphNodeCenter(from.column, from.lane);
          const b = graphNodeCenter(to.column, to.lane);
          const midX = (a.cx + b.cx) / 2;
          const dashed = edge.kind === "projected" || edge.kind === "tutor";
          return (
            <path
              key={`${edge.fromId}->${edge.toId}`}
              d={`M ${a.cx} ${a.cy} C ${midX} ${a.cy}, ${midX} ${b.cy}, ${b.cx} ${b.cy}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth={edge.kind === "tutor" ? 1.75 : 1.5}
              strokeDasharray={
                edge.kind === "projected" ? "2 3" : dashed ? "4 3" : undefined
              }
              className={cn(
                edge.kind === "tutor"
                  ? "stroke-primary/70"
                  : edge.kind === "projected"
                    ? "stroke-muted-foreground/45"
                    : undefined,
              )}
            />
          );
        })}
      </svg>

      {graph.nodes.map((node) => {
        const { cx, cy } = graphNodeCenter(node.column, node.lane);
        const selected = node.id === focusedNodeId;
        const caption = shortCaption(node.caption);
        const meta = { branchId: node.branchId, decisionId: node.decisionId };
        if (node.kind === "overflow" && node.overflowTries) {
          return (
            <BranchPicker
              key={node.id}
              tries={node.overflowTries}
              disabled={disabled}
              orientation={orientation}
              onSelectTry={(nodeId) =>
                onSelectNode(nodeId, {
                  branchId: tryBranchId(nodeId),
                  decisionId: node.decisionId,
                })
              }
              onPreviewNode={onPreviewNode}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: cx, top: cy }}
            />
          );
        }
        return (
          <div key={node.id}>
            {caption ? (
              <span
                className={cn(
                  "pointer-events-none absolute truncate text-center text-[0.6rem] leading-none",
                  node.kind === "tutor" || node.kind === "practice"
                    ? "text-primary"
                    : "text-muted-foreground",
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
                    disabled={disabled}
                    className={cn(
                      "group absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full sm:size-9",
                      "bg-transparent",
                      "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "touch-manipulation",
                    )}
                    style={{ left: cx, top: cy }}
                    onClick={() => {
                      if (node.isDecision) {
                        onSelectDecision(node.id, meta);
                        if (node.prominent) onOpenCoach?.();
                        return;
                      }
                      onSelectNode(node.id, meta);
                      if (node.kind === "tutor") onOpenCoach?.();
                    }}
                    onPointerEnter={() => onPreviewNode?.(node.id)}
                  />
                }
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    selected && "ring-2 ring-primary",
                    node.isLive && !selected && "ring-2 ring-primary/55",
                    !selected &&
                      "group-hover:ring-1 group-hover:ring-foreground/30",
                  )}
                >
                  <NodeGlyph node={node} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{tooltipFor(node)}</TooltipContent>
            </Tooltip>
            <span
              className={cn(
                "pointer-events-none absolute truncate text-center font-mono text-[0.65rem] leading-none tabular-nums text-muted-foreground",
                node.kind === "projected" && "opacity-70",
                node.prominent && "text-primary",
                node.kind === "tutor" && "text-primary",
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
