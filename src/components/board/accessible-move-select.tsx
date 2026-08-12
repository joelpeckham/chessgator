"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type GameMove, getLegalMoves } from "@/domain/game";

export type AccessibleMoveSelectProps = {
  fen: string;
  disabled?: boolean;
  onSelectMove: (move: GameMove) => void;
};

/** Keyboard-accessible alternative to board drag/click for playing a legal move. */
export function AccessibleMoveSelect({
  fen,
  disabled = false,
  onSelectMove,
}: AccessibleMoveSelectProps) {
  const moves = getLegalMoves(fen);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="accessible-move-select"
        className="text-xs font-medium text-muted-foreground"
      >
        Play move (keyboard)
      </label>
      <Select
        key={fen}
        disabled={disabled || moves.length === 0}
        onValueChange={(value) => {
          if (value == null) return;
          const move = moves.find((entry) => entry.uci === value);
          if (move) onSelectMove(move);
        }}
      >
        <SelectTrigger
          id="accessible-move-select"
          className="w-full min-w-0"
          size="default"
          data-testid="accessible-move-select"
        >
          <SelectValue placeholder="Choose a legal move" />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {moves.map((move) => (
            <SelectItem key={move.uci} value={move.uci}>
              {move.san}
              <span className="text-muted-foreground"> ({move.uci})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
