"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { popSpring } from "@/lib/motion-presets";

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
      <motion.span
        key={copied ? "copied" : "copy"}
        className="inline-block"
        initial={{ scale: 0.7, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={popSpring}
      >
        {copied ? "Copied" : "Copy PGN"}
      </motion.span>
    </Button>
  );
}
