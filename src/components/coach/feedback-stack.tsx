"use client";

import type { HintStep, TeachingInsight } from "@/domain/teaching";
import { TeachingCard } from "@/components/coach/teaching-card";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { RiCloseLine } from "@remixicon/react";

export type FeedbackNotice = {
  id: string;
  title: string;
  body?: string | null;
  variant?: "default" | "destructive";
  dismissible?: boolean;
  busy?: boolean;
};

export type FeedbackStackProps = {
  notices: FeedbackNotice[];
  onDismissNotice: (id: string) => void;
  tutorOpen: boolean;
  insight: TeachingInsight | null;
  analyzing: boolean;
  canTakebackRetry: boolean;
  onTakebackRetry: () => void;
  onTrySuggested?: () => void;
  onDismissTutor: () => void;
  hint: HintStep | null;
  hintDisabled?: boolean;
  onRequestHint: () => void;
  className?: string;
};

/**
 * Floating toast stack (upper-right): engine/status notices + dismissible tutor.
 * Out of document flow — must not affect board size.
 */
export function FeedbackStack({
  notices,
  onDismissNotice,
  tutorOpen,
  insight,
  analyzing,
  canTakebackRetry,
  onTakebackRetry,
  onTrySuggested,
  onDismissTutor,
  hint,
  hintDisabled = false,
  onRequestHint,
  className,
}: FeedbackStackProps) {
  const visibleNotices = notices.slice(0, 3);
  const empty = visibleNotices.length === 0 && !tutorOpen;
  if (empty) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed top-14 right-3 z-40 flex w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(70dvh,28rem)] flex-col gap-2 overflow-y-auto overscroll-contain",
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
            <AlertDescription className="text-xs">{notice.body}</AlertDescription>
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

      {tutorOpen ? (
        <div
          className="pointer-events-auto relative motion-safe:animate-in motion-safe:slide-in-from-right-2 motion-safe:fade-in-0"
          data-testid="coach-panel"
        >
          <TeachingCard
            insight={insight}
            analyzing={analyzing}
            canTakebackRetry={canTakebackRetry}
            onTakebackRetry={onTakebackRetry}
            onTrySuggested={onTrySuggested}
            hint={hint}
            hintDisabled={hintDisabled}
            onRequestHint={onRequestHint}
          />
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="absolute top-2 right-2 z-10"
            aria-label="Dismiss tutor"
            data-testid="dismiss-teaching-card"
            onClick={onDismissTutor}
          >
            <RiCloseLine />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
