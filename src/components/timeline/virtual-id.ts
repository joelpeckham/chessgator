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
