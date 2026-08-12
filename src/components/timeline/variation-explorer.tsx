"use client";

import type { VariationExplorerState } from "@/domain/game";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VariationExplorerProps = {
  explorer: VariationExplorerState | null;
  busy?: boolean;
  onStepBack: () => void;
  onStepForward: () => void;
  onExit: () => void;
  onTryInstead: () => void;
  className?: string;
};

export function VariationExplorer({
  explorer,
  busy = false,
  onStepBack,
  onStepForward,
  onExit,
  onTryInstead,
  className,
}: VariationExplorerProps) {
  if (!explorer) return null;

  const atStart = explorer.stepIndex <= 0;
  const atEnd = explorer.stepIndex >= explorer.lineUci.length;
  const firstUci = explorer.lineUci[0] ?? null;

  return (
    <section
      aria-label="Variation explorer"
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-muted/40 p-3 ring-1 ring-foreground/10",
        className,
      )}
      data-testid="variation-explorer"
      data-step={explorer.stepIndex}
      data-line-length={explorer.lineUci.length}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-xs font-medium text-muted-foreground">
          Variation explorer
        </h2>
        <p className="font-mono text-xs leading-5" data-testid="variation-line">
          {explorer.lineUci.map((uci, index) => (
            <span
              key={`${uci}-${index}`}
              className={cn(
                "mr-1 inline-block rounded px-1",
                index < explorer.stepIndex && "bg-primary/20",
                index === explorer.stepIndex - 1 && "ring-1 ring-primary/50",
              )}
            >
              {uci}
            </span>
          ))}
        </p>
        <p className="text-xs text-muted-foreground" data-testid="variation-status">
          Step {explorer.stepIndex} of {explorer.lineUci.length}
          {atStart ? " · at origin" : ""}
          {atEnd ? " · end of line" : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || atStart}
          onClick={onStepBack}
          data-testid="variation-back"
        >
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || atEnd}
          onClick={onStepForward}
          data-testid="variation-forward"
        >
          Forward
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || !firstUci}
          onClick={onTryInstead}
          data-testid="variation-try-instead"
        >
          Try instead
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onExit}
          data-testid="variation-exit"
        >
          Return to origin
        </Button>
      </div>
    </section>
  );
}
