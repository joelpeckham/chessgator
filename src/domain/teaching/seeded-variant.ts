function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickSeededVariant(
  variants: readonly string[],
  seed: string | undefined,
  key: string,
): string {
  const first = variants[0];
  if (!first) return "";
  if (!seed || variants.length === 1) return first;
  const index = hashSeed(`${seed}:${key}`) % variants.length;
  return variants[index] ?? first;
}
