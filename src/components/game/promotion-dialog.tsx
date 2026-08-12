"use client";

import type { PieceSymbol } from "@/domain/game";
import { PROMOTION_PIECES } from "@/components/board/move-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LABELS: Record<PieceSymbol, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
  p: "Pawn",
  k: "King",
};

export type PromotionDialogProps = {
  open: boolean;
  from: string;
  to: string;
  onChoose: (piece: PieceSymbol) => void;
  onCancel: () => void;
};

export function PromotionDialog({
  open,
  from,
  to,
  onChoose,
  onCancel,
}: PromotionDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-sm"
        data-testid="promotion-dialog"
      >
        <DialogHeader>
          <DialogTitle>Choose promotion</DialogTitle>
          <DialogDescription>
            Promote the pawn from {from} to {to}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {PROMOTION_PIECES.map((piece) => (
            <Button
              key={piece}
              type="button"
              variant={piece === "q" ? "default" : "outline"}
              onClick={() => onChoose(piece)}
              data-testid={`promote-${piece}`}
            >
              {LABELS[piece]}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
