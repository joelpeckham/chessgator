"use client";

import { AccessibleMoveSelect } from "@/components/board/accessible-move-select";
import { MAIA_ELO_OPTIONS } from "@/components/game/maia-elo-options";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import type { GameMove } from "@/domain/game";

export type SettingsEngineStatus = {
  message: string | null;
  starting: boolean;
  failed: boolean;
  coachMessage: string | null;
  onRetry: () => void;
};

export type SettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maiaElo: number;
  onMaiaEloChange: (elo: number) => void;
  fen: string;
  canPlayMove: boolean;
  onSelectMove: (move: GameMove) => void;
  engine: SettingsEngineStatus;
  canResign: boolean;
  canRestart: boolean;
  onResign: () => void;
  onRestart: () => void;
};

export function SettingsSheet({
  open,
  onOpenChange,
  maiaElo,
  onMaiaEloChange,
  fen,
  canPlayMove,
  onSelectMove,
  engine,
  canResign,
  canRestart,
  onResign,
  onRestart,
}: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0"
        data-testid="settings-sheet"
      >
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Opponent strength, engines, and game actions.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <section className="flex flex-col gap-2" data-testid="game-controls">
            <label
              htmlFor="maia-elo"
              className="text-xs font-medium text-muted-foreground"
            >
              Maia Elo
            </label>
            <Select
              value={String(maiaElo)}
              onValueChange={(value) => {
                if (value != null) onMaiaEloChange(Number(value));
              }}
              disabled={engine.starting}
            >
              <SelectTrigger id="maia-elo" data-testid="maia-elo-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAIA_ELO_OPTIONS.map((elo) => (
                  <SelectItem key={elo} value={String(elo)}>
                    {elo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="flex flex-col gap-2" aria-label="Engine status">
            <h3 className="text-xs font-medium text-muted-foreground">
              Engines
            </h3>
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <div className="flex items-start gap-2">
                {engine.starting ? <Spinner className="mt-0.5" /> : null}
                <div className="flex min-w-0 flex-col gap-1">
                  <p data-testid="engine-status-message">
                    {engine.message ??
                      (engine.failed
                        ? "Opponent engine failed"
                        : "Engines ready")}
                  </p>
                  {engine.coachMessage ? (
                    <p className="text-xs text-destructive">
                      {engine.coachMessage}
                    </p>
                  ) : null}
                </div>
              </div>
              {engine.failed ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={engine.onRetry}
                  data-testid="retry-engines-button"
                >
                  Retry engines
                </Button>
              ) : null}
            </div>
          </section>

          <Separator />

          <AccessibleMoveSelect
            fen={fen}
            disabled={!canPlayMove}
            onSelectMove={onSelectMove}
          />

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onRestart}
              disabled={!canRestart || engine.starting}
              data-testid="restart-button"
            >
              New game
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onResign}
              disabled={!canResign || engine.starting}
              data-testid="resign-button"
            >
              Resign
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
