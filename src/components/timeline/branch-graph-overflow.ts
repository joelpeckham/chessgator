/**
 * Pin an overflow branch into a variation lane, keeping at most `maxLaneSide`
 * pins under the same parent.
 */
export function pinOverflowBranch(args: {
  expandedOverflowKeys: readonly string[];
  parentId: string;
  branchKey: string;
  maxLaneSide: number;
}): string[] {
  const parentPrefix = `var:${args.parentId}:`;
  const next = [
    ...args.expandedOverflowKeys.filter((k) => !k.startsWith(parentPrefix)),
    args.branchKey,
  ];
  const parentPins = next.filter((k) => k.startsWith(parentPrefix));
  const others = next.filter((k) => !k.startsWith(parentPrefix));
  return [...others, ...parentPins.slice(-args.maxLaneSide)];
}
