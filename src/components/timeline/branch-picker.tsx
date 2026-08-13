"use client";

import { type CSSProperties, useState } from "react";
import { BoardPreview } from "@/components/board/board-preview";
import type { SavedTryView } from "@/components/timeline/decision-types";
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
  tries: readonly SavedTryView[];
  disabled?: boolean;
  orientation?: "white" | "black";
  onSelectTry: (nodeId: string) => void;
  onPreviewNode?: (nodeId: string | null) => void;
  className?: string;
  style?: CSSProperties;
};

/**
 * Accessible overflow picker for saved tries at a decision.
 */
export function BranchPicker({
  tries,
  disabled = false,
  orientation = "white",
  onSelectTry,
  onPreviewNode,
  className,
  style,
}: BranchPickerProps) {
  const [open, setOpen] = useState(false);
  const count = tries.length;
  if (count === 0) return null;

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
            aria-label={`${count} more tries`}
            data-testid="saved-tries"
            data-timeline-node="true"
            data-kind="variation"
            data-overflow="true"
            className={cn(
              "flex size-11 items-center justify-center rounded-full bg-transparent sm:size-9",
              "outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring",
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
          <PopoverTitle>Saved tries</PopoverTitle>
          <PopoverDescription>
            Choose a line you already explored.
          </PopoverDescription>
        </PopoverHeader>
        <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          {tries.map((branch) => (
            <li key={branch.nodeId}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start gap-3 px-2 py-2"
                data-testid={`branch-picker-item-${branch.nodeId}`}
                onPointerEnter={() => onPreviewNode?.(branch.nodeId)}
                onClick={() => {
                  onSelectTry(branch.nodeId);
                  setOpen(false);
                }}
              >
                <BoardPreview
                  fen={branch.fen}
                  san={branch.san}
                  orientation={orientation}
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
