"use client";

import { RiErrorWarningLine } from "@remixicon/react";
import { useState } from "react";
import { AccessibleMoveSelect } from "@/components/board/accessible-move-select";
import { CopyPgnButton } from "@/components/game/copy-pgn-button";
import {
  formatMaiaElo,
  MAIA_ELO_ITEMS,
  MAIA_ELO_OPTIONS,
} from "@/components/game/maia-elo-options";
import { PlayAsToggle } from "@/components/game/play-as-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import type { Color, GameMove } from "@/domain/game";

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
  confirmRestart: boolean;
  pgn: string;
  pendingHumanColor: Color;
  onPendingHumanColorChange: (color: Color) => void;
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
  confirmRestart,
  pgn,
  pendingHumanColor,
  onPendingHumanColorChange,
  onResign,
  onRestart,
}: SettingsSheetProps) {
  const [confirm, setConfirm] = useState<"resign" | "restart" | null>(null);
  const playAsLabel = pendingHumanColor === "b" ? "Black" : "White";

  function requestRestart(): void {
    if (confirmRestart) {
      setConfirm("restart");
      return;
    }
    onRestart();
  }

  function requestResign(): void {
    setConfirm("resign");
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="gap-0 p-0"
          data-testid="settings-sheet"
        >
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription className="sr-only">
              Opponent strength, next game, and actions for this game.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
            {engine.failed ? (
              <Alert variant="destructive">
                <RiErrorWarningLine />
                <AlertTitle>Engines failed</AlertTitle>
                <AlertDescription>
                  <p data-testid="engine-status-message">
                    {engine.message ?? "Opponent engine failed"}
                  </p>
                  {engine.coachMessage ? <p>{engine.coachMessage}</p> : null}
                </AlertDescription>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={engine.onRetry}
                  data-testid="retry-engines-button"
                >
                  Retry engines
                </Button>
              </Alert>
            ) : null}

            <section className="flex flex-col gap-2">
              <label
                htmlFor="maia-elo"
                className="text-xs font-medium text-muted-foreground"
              >
                Opponent strength
              </label>
              <Select
                value={String(maiaElo)}
                items={MAIA_ELO_ITEMS}
                onValueChange={(value) => {
                  if (value != null) onMaiaEloChange(Number(value));
                }}
                disabled={engine.starting}
              >
                <SelectTrigger
                  id="maia-elo"
                  className="w-full min-w-0"
                  data-testid="maia-elo-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAIA_ELO_OPTIONS.map((option) => (
                    <SelectItem key={option.elo} value={String(option.elo)}>
                      {formatMaiaElo(option.elo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Takes effect from Maia&apos;s next move.
              </p>
            </section>

            <section
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
              data-testid="game-controls"
            >
              <h3 className="text-xs font-medium text-muted-foreground">
                Next game
              </h3>
              <div className="flex flex-col gap-2">
                <span
                  id="play-as-label"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Play as
                </span>
                <PlayAsToggle
                  value={pendingHumanColor}
                  onChange={onPendingHumanColorChange}
                  disabled={engine.starting}
                  labelledBy="play-as-label"
                />
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={requestRestart}
                disabled={!canRestart || engine.starting}
                data-testid="restart-button"
              >
                Start new game
              </Button>
              <p className="text-xs text-muted-foreground">
                Starts a fresh game as {playAsLabel} vs Maia {maiaElo}.
              </p>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                This game
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={requestResign}
                  disabled={!canResign || engine.starting}
                  data-testid="resign-button"
                >
                  Resign
                </Button>
                <CopyPgnButton pgn={pgn} />
              </div>
              <Separator />
              <AccessibleMoveSelect
                fen={fen}
                disabled={!canPlayMove}
                onSelectMove={onSelectMove}
              />
            </section>
          </div>

          {engine.failed ? null : (
            <SheetFooter className="border-t border-border p-4">
              <div
                className="flex items-start gap-2 text-xs text-muted-foreground"
                aria-label="Engine status"
              >
                {engine.starting ? (
                  <Spinner className="mt-0.5 size-3.5" />
                ) : null}
                <div className="flex min-w-0 flex-col gap-1">
                  <p data-testid="engine-status-message">
                    {engine.message ?? "Engines ready"}
                  </p>
                  {engine.coachMessage ? (
                    <p className="text-destructive">{engine.coachMessage}</p>
                  ) : null}
                </div>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirm != null}
        onOpenChange={(next) => {
          if (!next) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "resign" ? "Resign this game?" : "Start a new game?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "resign"
                ? "This ends the current game. You can still review the board afterward."
                : "This replaces the current game. The saved position will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirm-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "resign" ? "destructive" : "default"}
              data-testid={
                confirm === "resign" ? "confirm-resign" : "confirm-restart"
              }
              onClick={() => {
                if (confirm === "resign") onResign();
                else onRestart();
                setConfirm(null);
              }}
            >
              {confirm === "resign" ? "Resign" : "New game"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
