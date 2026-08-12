"use client";

import { RiCloseLine } from "@remixicon/react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { FeedbackNotice } from "@/domain/teaching";
import { cn } from "@/lib/utils";

export type { FeedbackNotice };

export type FeedbackStackProps = {
  notices: FeedbackNotice[];
  onDismissNotice: (id: string) => void;
  className?: string;
};

/**
 * Floating toast stack (upper-right) for engine/status notices only.
 * Coach feedback lives in CoachRail above the timeline.
 */
export function FeedbackStack({
  notices,
  onDismissNotice,
  className,
}: FeedbackStackProps) {
  const visibleNotices = notices.slice(0, 2);
  if (visibleNotices.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed top-14 right-3 z-40 flex w-[min(20rem,calc(100vw-1.5rem))] max-h-[min(40dvh,16rem)] flex-col gap-2 overflow-y-auto overscroll-contain",
        className,
      )}
      data-testid="feedback-stack"
    >
      {visibleNotices.map((notice) => (
        <Alert
          key={notice.id}
          variant={notice.variant === "destructive" ? "destructive" : "default"}
          className="pointer-events-auto py-2 shadow-sm"
          data-testid={`notice-${notice.id}`}
        >
          {notice.busy ? <Spinner /> : null}
          <AlertTitle className="text-sm">{notice.title}</AlertTitle>
          {notice.body ? (
            <AlertDescription className="text-xs">
              {notice.body}
            </AlertDescription>
          ) : null}
          {notice.dismissible !== false ? (
            <AlertAction>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Dismiss ${notice.title}`}
                onClick={() => onDismissNotice(notice.id)}
              >
                <RiCloseLine />
              </Button>
            </AlertAction>
          ) : null}
        </Alert>
      ))}
    </div>
  );
}
