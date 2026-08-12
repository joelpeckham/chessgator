"use client";

import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiSkipBackLine,
  RiSkipForwardLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function TransportButton({
  label,
  tooltip,
  testId,
  disabled,
  variant = "ghost",
  onClick,
  icon,
}: {
  label: string;
  tooltip: string;
  testId: string;
  disabled: boolean;
  variant?: "ghost" | "default";
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-xs"
            variant={variant}
            className="size-11 sm:size-7"
            disabled={disabled}
            aria-label={label}
            data-testid={testId}
            onClick={onClick}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function TimelineTransport({
  disabled,
  isReviewing,
  onFirst,
  onPrev,
  onNext,
  onLive,
}: {
  disabled: boolean;
  isReviewing: boolean;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLive: () => void;
}) {
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-border pl-2"
      data-testid="timeline-transport"
    >
      <div className="flex items-center gap-0.5">
        <TransportButton
          label="Go to start"
          tooltip="Start"
          testId="timeline-first"
          disabled={disabled}
          onClick={onFirst}
          icon={<RiSkipBackLine />}
        />
        <TransportButton
          label="Previous move"
          tooltip="Previous"
          testId="timeline-prev"
          disabled={disabled}
          onClick={onPrev}
          icon={<RiArrowLeftLine />}
        />
        <TransportButton
          label="Next move"
          tooltip="Next"
          testId="timeline-next"
          disabled={disabled}
          onClick={onNext}
          icon={<RiArrowRightLine />}
        />
        <TransportButton
          label="Return to live position"
          tooltip="Live"
          testId="timeline-live"
          disabled={disabled || !isReviewing}
          variant={isReviewing ? "default" : "ghost"}
          onClick={onLive}
          icon={<RiSkipForwardLine />}
        />
      </div>
    </div>
  );
}
