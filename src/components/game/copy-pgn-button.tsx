"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type CopyPgnButtonProps = {
  pgn: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost";
};

export function CopyPgnButton({
  pgn,
  size = "sm",
  variant = "outline",
}: CopyPgnButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        resetTimer.current = null;
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={() => {
        void copy();
      }}
      data-testid="copy-pgn-button"
    >
      {copied ? "Copied" : "Copy PGN"}
    </Button>
  );
}
