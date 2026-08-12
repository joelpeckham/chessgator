"use client";

import type {
  GameStatus,
  GameStatusReason,
  SessionMode,
} from "@/domain/game";
import type { MaiaSessionState } from "@/features/game/maia-session";
import { getStatusPresentation } from "@/features/game/status-copy";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusPanelProps = {
  mode: SessionMode;
  status: GameStatus;
  /** Session override (e.g. resignation) when rules status is still ongoing. */
  terminalReason?: GameStatusReason | null;
  maia: MaiaSessionState;
  lastError: string | null;
  /** Persistent coaching/engine failure that still allows play. */
  coachUnavailable?: string | null;
};

export function StatusPanel({
  mode,
  status,
  terminalReason = null,
  maia,
  lastError,
  coachUnavailable = null,
}: StatusPanelProps) {
  const { headline, detail, badgeLabel, badgeVariant } = getStatusPresentation({
    mode,
    status,
    terminalReason,
    maia,
    lastError,
    coachUnavailable,
  });

  return (
    <section
      aria-label="Game status"
      className="flex flex-col gap-3"
      data-testid="status-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={badgeVariant}
          data-testid="status-badge"
          data-mode={mode}
          data-opponent-phase={maia.phase}
        >
          {badgeLabel}
        </Badge>
        {coachUnavailable ? (
          <Badge
            variant="outline"
            data-testid="coach-unavailable-badge"
            className="text-amber-800 dark:text-amber-200"
          >
            Coach unavailable
          </Badge>
        ) : null}
        {status.isCheck && !status.isGameOver ? (
          <Badge variant="destructive" data-testid="check-badge">
            Check
          </Badge>
        ) : null}
      </div>

      <div>
        <p className="font-heading text-lg font-medium tracking-tight">
          {headline}
        </p>
        {detail ? (
          <p
            className="mt-1 text-sm text-muted-foreground"
            data-testid="status-detail"
          >
            {detail}
          </p>
        ) : null}
      </div>

      {maia.phase === "starting" ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Engine loading"
          aria-valuetext={maia.message ?? "Loading"}
          data-testid="engine-progress"
        >
          <div
            className={cn(
              "h-full w-1/2 rounded-full bg-primary",
              "motion-safe:animate-pulse",
            )}
          />
        </div>
      ) : null}
    </section>
  );
}
