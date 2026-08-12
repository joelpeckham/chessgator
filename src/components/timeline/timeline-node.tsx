"use client";

import { BoardPreview } from "@/components/board/board-preview";
import type { TimelineGraphNode } from "@/components/timeline/branch-graph";
import { COL_W, LANE_H, NODE_R } from "@/components/timeline/timeline-layout";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

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

export function TimelineNode({
  node,
  cx,
  cy,
  selected,
  dimmed,
  disabled,
  onSelect,
}: {
  node: TimelineGraphNode;
  cx: number;
  cy: number;
  selected: boolean;
  dimmed: boolean;
  disabled: boolean;
  onSelect: (node: TimelineGraphNode) => void;
}) {
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
        node.kind === "variation" || node.kind === "tutor" ? "true" : "false"
      }
      data-testid={`timeline-node-${node.id}`}
      disabled={disabled}
      className={cn(
        "absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full sm:size-7",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "touch-manipulation",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        dimmed && "opacity-40",
      )}
      style={{ left: cx, top: cy }}
      onClick={() => onSelect(node)}
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
    <div>
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
        {node.kind === "projected" ? `~${node.san ?? ""}` : node.moveLabel}
        {node.isTruncated ? "…" : ""}
      </span>
    </div>
  );
}

export function nodeCenter(
  node: TimelineGraphNode,
  midY: number,
): {
  cx: number;
  cy: number;
} {
  return {
    cx: node.column * COL_W + COL_W / 2,
    cy: midY - node.lane * LANE_H,
  };
}
