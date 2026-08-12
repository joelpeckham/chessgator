"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import {
  getAncestors,
  getNode,
  listMainlineChild,
  type GameNode,
  type GameTree,
} from "@/domain/game";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TimelineEntry = {
  node: GameNode;
  plyLabel: string;
  san: string;
  isCurrent: boolean;
  isOnPath: boolean;
  isVariation: boolean;
  branchAlternates: GameNode[];
};

export type MoveTimelineProps = {
  tree: GameTree;
  disabled?: boolean;
  onJump: (nodeId: string) => void;
  onTakeback?: () => void;
  canTakeback?: boolean;
  className?: string;
};

function plyLabelFor(node: GameNode): string {
  if (!node.move) return "Start";
  const moveNo = Math.floor((node.ply + 1) / 2);
  return node.move.color === "w" ? `${moveNo}.` : `${moveNo}...`;
}

/**
 * Timeline for the path root → current, with sibling branches and a short
 * forward mainline continuation from the current node.
 */
export function buildTimelineEntries(tree: GameTree): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const ancestors = getAncestors(tree, tree.currentNodeId);
  const pathIds = new Set(ancestors.map((n) => n.id));

  for (const node of ancestors) {
    const mainChild = listMainlineChild(tree, node.id);
    const alternates = node.childIds
      .map((id) => tree.nodes[id])
      .filter((child): child is GameNode => {
        if (!child) return false;
        if (pathIds.has(child.id)) return false;
        // Forward mainline is rendered as continuation, not a branch chip.
        if (mainChild && child.id === mainChild.id) return false;
        return true;
      });

    entries.push({
      node,
      plyLabel: node.move ? plyLabelFor(node) : "",
      san: node.move?.san ?? "Start",
      isCurrent: tree.currentNodeId === node.id,
      isOnPath: true,
      isVariation: node.isVariation,
      branchAlternates: alternates,
    });
  }

  let cursor = listMainlineChild(tree, tree.currentNodeId);
  while (cursor) {
    const parent = cursor.parentId ? getNode(tree, cursor.parentId) : null;
    const alternates =
      parent?.childIds
        .filter((id) => id !== cursor!.id)
        .map((id) => tree.nodes[id])
        .filter((n): n is GameNode => Boolean(n)) ?? [];

    entries.push({
      node: cursor,
      plyLabel: plyLabelFor(cursor),
      san: cursor.move?.san ?? "…",
      isCurrent: false,
      isOnPath: false,
      isVariation: cursor.isVariation,
      branchAlternates: alternates,
    });
    cursor = listMainlineChild(tree, cursor.id);
  }

  return entries;
}

export function MoveTimeline({
  tree,
  disabled = false,
  onJump,
  onTakeback,
  canTakeback = false,
  className,
}: MoveTimelineProps) {
  const entries = useMemo(() => buildTimelineEntries(tree), [tree]);
  const listRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const pathHasMoves = entries.some(
    (entry) => entry.isOnPath && entry.node.move != null,
  );

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [tree.currentNodeId]);

  function focusRelative(delta: number): void {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[data-timeline-node="true"]',
    );
    if (!buttons?.length) return;
    const ids = [...buttons].map((b) => b.dataset.nodeId);
    const currentIndex = ids.indexOf(tree.currentNodeId);
    const next = Math.min(
      buttons.length - 1,
      Math.max(0, (currentIndex < 0 ? 0 : currentIndex) + delta),
    );
    buttons[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      focusRelative(1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusRelative(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      onJump(tree.rootId);
    } else if (event.key === "End") {
      event.preventDefault();
      const last = entries[entries.length - 1];
      if (last) onJump(last.node.id);
    }
  }

  return (
    <section
      aria-label="Move timeline"
      className={cn("flex flex-col gap-2", className)}
      data-testid="move-timeline"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">Timeline</h2>
        {onTakeback ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !canTakeback}
            onClick={onTakeback}
            data-testid="timeline-takeback"
          >
            Take back
          </Button>
        ) : null}
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Game moves"
        aria-activedescendant={`timeline-node-${tree.currentNodeId}`}
        tabIndex={0}
        className="max-h-48 overflow-y-auto rounded-2xl bg-muted/50 p-2 focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="move-list"
        onKeyDown={onKeyDown}
      >
        {!pathHasMoves ? (
          <p className="px-2 py-1 font-mono text-xs text-muted-foreground">
            No moves yet
          </p>
        ) : null}
        <ol className="flex list-none flex-col gap-1">
          {entries.map((entry) => {
            const id = `timeline-node-${entry.node.id}`;
            return (
              <li key={entry.node.id} className="flex flex-col gap-1">
                <button
                  ref={entry.isCurrent ? currentRef : undefined}
                  type="button"
                  id={id}
                  role="option"
                  aria-selected={entry.isCurrent}
                  data-timeline-node="true"
                  data-node-id={entry.node.id}
                  data-variation={entry.isVariation ? "true" : "false"}
                  data-testid={`timeline-node-${entry.node.ply}`}
                  disabled={disabled}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left font-mono text-xs",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "min-h-9 touch-manipulation",
                    entry.isCurrent && "bg-primary/15 ring-1 ring-primary/40",
                    !entry.isCurrent &&
                      entry.isOnPath &&
                      "bg-background/70",
                    !entry.isOnPath && "text-muted-foreground",
                    entry.isVariation && "italic",
                  )}
                  onClick={() => onJump(entry.node.id)}
                >
                  {entry.plyLabel ? (
                    <span className="w-8 shrink-0 text-muted-foreground">
                      {entry.plyLabel}
                    </span>
                  ) : (
                    <span className="w-8 shrink-0" />
                  )}
                  <span className="font-medium">{entry.san}</span>
                  {entry.isVariation ? (
                    <span
                      className="ml-auto rounded-sm bg-background/90 px-1 text-[0.65rem] uppercase tracking-wide text-foreground ring-1 ring-foreground/25"
                      aria-label="Variation"
                    >
                      var
                    </span>
                  ) : null}
                  {entry.isCurrent ? (
                    <span className="sr-only">(current position)</span>
                  ) : null}
                </button>

                {entry.branchAlternates.length > 0 ? (
                  <div
                    className="ml-6 flex flex-wrap gap-1"
                    aria-label="Alternate branches"
                  >
                    {entry.branchAlternates.map((alt) => (
                      <button
                        key={alt.id}
                        type="button"
                        data-timeline-node="true"
                        data-node-id={alt.id}
                        data-variation={alt.isVariation ? "true" : "false"}
                        disabled={disabled}
                        className={cn(
                          "rounded-lg px-2 py-1 font-mono text-[0.7rem]",
                          "min-h-8 ring-1 ring-foreground/15",
                          "focus-visible:ring-2 focus-visible:ring-ring",
                          alt.isVariation && "italic",
                          tree.currentNodeId === alt.id &&
                            "bg-primary/15 ring-primary/40",
                        )}
                        onClick={() => onJump(alt.id)}
                        aria-label={`Branch ${alt.move?.san ?? "move"}${
                          alt.isVariation ? ", variation" : ""
                        }`}
                      >
                        {alt.move?.san ?? "…"}
                        {alt.isVariation ? "ᵛ" : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
