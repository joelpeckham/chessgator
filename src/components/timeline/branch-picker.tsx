"use client";

import { type CSSProperties, useState } from "react";
import { BoardPreview } from "@/components/board/board-preview";
import type { TimelineOverflowGroup } from "@/components/timeline/branch-graph";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type BranchPickerProps = {
  group: TimelineOverflowGroup;
  disabled?: boolean;
  onSelectBranch: (branchKey: string, headNodeId: string) => void;
  onPreviewNode?: (nodeId: string | null) => void;
  className?: string;
  style?: CSSProperties;
};

/**
 * Accessible overflow branch picker at a divergence point.
 * Selecting a hidden branch pins it into a variation lane.
 */
export function BranchPicker({
  group,
  disabled = false,
  onSelectBranch,
  onPreviewNode,
  className,
  style,
}: BranchPickerProps) {
  const [open, setOpen] = useState(false);
  const count = group.hiddenBranches.length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onPreviewNode?.(null);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-label={`${count} more branches`}
            data-testid={`overflow-${group.id}`}
            data-timeline-node="true"
            data-kind="variation"
            data-overflow="true"
            className={cn(
              "absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full sm:size-7",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "touch-manipulation",
              className,
            )}
            style={style}
          />
        }
      >
        <span
          className="flex size-6 items-center justify-center rounded-full border-2 border-muted-foreground bg-background font-mono text-[0.65rem] font-medium text-foreground"
          aria-hidden
        >
          +{count}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-72 gap-2 p-3"
        data-testid="branch-picker"
      >
        <PopoverHeader>
          <PopoverTitle>More branches</PopoverTitle>
          <PopoverDescription>
            Choose a line to show on the timeline.
          </PopoverDescription>
        </PopoverHeader>
        <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {group.hiddenBranches.map((branch) => (
            <li key={branch.branchKey}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start gap-3 px-2 py-2"
                data-testid={`branch-picker-item-${branch.headNodeId}`}
                onPointerEnter={() => onPreviewNode?.(branch.headNodeId)}
                onClick={() => {
                  onSelectBranch(branch.branchKey, branch.headNodeId);
                  setOpen(false);
                }}
              >
                <BoardPreview
                  fen={branch.fen}
                  san={branch.san}
                  className="w-16 shrink-0"
                />
                <span className="flex min-w-0 flex-col items-start text-left">
                  <span className="font-mono text-sm font-medium">
                    {branch.moveLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {branch.length} {branch.length === 1 ? "ply" : "plies"}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
