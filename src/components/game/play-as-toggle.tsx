"use client";

import { Button } from "@/components/ui/button";
import type { Color } from "@/domain/game";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "w", label: "White" },
  { value: "b", label: "Black" },
] as const;

export type PlayAsToggleProps = {
  value: Color;
  onChange: (color: Color) => void;
  disabled?: boolean;
  labelledBy?: string;
};

export function PlayAsToggle({
  value,
  onChange,
  disabled = false,
  labelledBy,
}: PlayAsToggleProps) {
  function select(next: Color, currentTarget: HTMLElement): void {
    onChange(next);
    const group = currentTarget.closest("[role='radiogroup']");
    const radios = group?.querySelectorAll<HTMLElement>("[role='radio']");
    const target = next === "w" ? radios?.[0] : radios?.[1];
    target?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      data-testid="play-as-select"
      className="grid grid-cols-2 gap-1 rounded-3xl bg-input/50 p-1"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            variant={selected ? "secondary" : "ghost"}
            className={cn("w-full", selected && "shadow-sm")}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (
                event.key !== "ArrowLeft" &&
                event.key !== "ArrowRight" &&
                event.key !== "ArrowUp" &&
                event.key !== "ArrowDown"
              ) {
                return;
              }
              event.preventDefault();
              select(option.value === "w" ? "b" : "w", event.currentTarget);
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
