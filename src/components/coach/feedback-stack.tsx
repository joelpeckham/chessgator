"use client";

import { RiCloseLine } from "@remixicon/react";
import { AnimatePresence, motion } from "motion/react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { FeedbackNotice } from "@/domain/teaching";
import { popSpring } from "@/lib/motion-presets";
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

  return (
    <div
      className={cn(
        "pointer-events-none fixed top-14 right-3 z-40 flex w-[min(20rem,calc(100vw-1.5rem))] max-h-[min(40dvh,16rem)] flex-col gap-2 overflow-y-auto overscroll-contain",
        className,
      )}
      data-testid="feedback-stack"
    >
      <AnimatePresence initial={false}>
        {visibleNotices.map((notice) => (
          <motion.div
            key={notice.id}
            layout
            className="pointer-events-auto"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: 24,
              transition: { duration: 0.18, ease: "easeIn" },
            }}
            transition={popSpring}
          >
            <Alert
              variant={
                notice.variant === "destructive" ? "destructive" : "default"
              }
              className="py-2 shadow-sm"
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
                <AlertAction className="top-1/2 -translate-y-1/2">
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
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
