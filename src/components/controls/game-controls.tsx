"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const MAIA_ELO_OPTIONS = [
  1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900,
] as const;

export type GameControlsProps = {
  maiaElo: number;
  onMaiaEloChange: (elo: number) => void;
  canStart: boolean;
  canResign: boolean;
  canRestart: boolean;
  starting: boolean;
  /** When true, primary action continues a resumed local game. */
  resumeAvailable?: boolean;
  onStart: () => void;
  onResign: () => void;
  onRestart: () => void;
};

export function GameControls({
  maiaElo,
  onMaiaEloChange,
  canStart,
  canResign,
  canRestart,
  starting,
  resumeAvailable = false,
  onStart,
  onResign,
  onRestart,
}: GameControlsProps) {
  return (
    <section
      aria-label="Game controls"
      className="flex flex-col gap-4"
      data-testid="game-controls"
    >
      <div className="flex flex-col gap-1.5">
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
          disabled={starting}
        >
          <SelectTrigger
            id="maia-elo"
            className="w-full"
            data-testid="maia-elo-select"
          >
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
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onStart}
          disabled={!canStart || starting}
          data-testid="start-button"
        >
          {starting
            ? "Starting…"
            : resumeAvailable
              ? "Continue"
              : "Start"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onRestart}
          disabled={!canRestart || starting}
          data-testid="restart-button"
        >
          Restart
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onResign}
          disabled={!canResign || starting}
          data-testid="resign-button"
        >
          Resign
        </Button>
      </div>
    </section>
  );
}
