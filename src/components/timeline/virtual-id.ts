export function virtualId(rootId: string, uci: string): string {
  return `suggested:${rootId}:${uci}`;
}

/**
 * Extract the suggested UCI from a virtual timeline id.
 * `suggested:rootId:e2e4` → `{ rootNodeId, uci: 'e2e4', kind }`
 */
export function parseVirtualTimelineId(id: string): {
  kind: "suggested";
  rootNodeId: string;
  uci: string;
} | null {
  const match = /^suggested:([^:]+):(.+)$/.exec(id);
  if (!match) return null;
  return {
    kind: "suggested",
    rootNodeId: match[1]!,
    uci: match[2]!,
  };
}
