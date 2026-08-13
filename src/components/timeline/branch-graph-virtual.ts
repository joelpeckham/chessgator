import type { ProjectedLine } from "@/domain/analysis/projected-lines";
import type { GameTree } from "@/domain/game";
import { getNode } from "@/domain/game";

export function virtualId(
  kind: "projected" | "tutor",
  rootId: string,
  pathKey: string,
): string {
  return `${kind}:${rootId}:${pathKey}`;
}

export function isVirtualTimelineId(id: string): boolean {
  return id.startsWith("projected:") || id.startsWith("tutor:");
}

/**
 * Extract the UCI path from a virtual timeline id relative to its root.
 * `tutor:rootId:e2e4/e7e5` → `{ rootNodeId, uciPath: ['e2e4','e7e5'], kind }`
 */
export function parseVirtualTimelineId(id: string): {
  kind: "projected" | "tutor";
  rootNodeId: string;
  uciPath: string[];
} | null {
  const match = /^(projected|tutor):([^:]+):(.+)$/.exec(id);
  if (!match) return null;
  const kind = match[1] as "projected" | "tutor";
  const rootNodeId = match[2]!;
  const pathKey = match[3]!;
  return {
    kind,
    rootNodeId,
    uciPath: pathKey.split("/").filter(Boolean),
  };
}

function fenFromLine(
  id: string,
  line: ProjectedLine | null | undefined,
): string | null {
  if (!line) return null;
  const parsed = parseVirtualTimelineId(id);
  if (!parsed) return null;
  const ply = line.plies.find(
    (item) => virtualId(parsed.kind, parsed.rootNodeId, item.pathKey) === id,
  );
  return ply?.fen ?? null;
}

/** Resolve the fen for a review/practice cursor against the tree or projected lines. */
export function resolveReviewFen(
  tree: GameTree,
  reviewNodeId: string | null,
  tutorLine?: ProjectedLine | null,
  engineLine?: ProjectedLine | null,
): string {
  const id = reviewNodeId ?? tree.currentNodeId;
  if (isVirtualTimelineId(id)) {
    const fromTutor = fenFromLine(id, tutorLine);
    if (fromTutor) return fromTutor;
    const fromEngine = fenFromLine(id, engineLine);
    if (fromEngine) return fromEngine;
    const parsed = parseVirtualTimelineId(id);
    if (parsed) {
      const root = getNode(tree, parsed.rootNodeId);
      if (root) return root.fen;
    }
  }
  const treeNode = getNode(tree, id);
  return treeNode?.fen ?? getNode(tree, tree.rootId)?.fen ?? "";
}
