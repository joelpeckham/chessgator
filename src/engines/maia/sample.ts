/**
 * Stable softmax, temperature, and top-p sampling over masked move logits.
 * Matches CSSLab/maia3 `sample_from_logits` (temperature <= 0 ⇒ argmax).
 */

export type SampleOptions = {
  temperature: number;
  topP: number;
  /**
   * Optional RNG in [0, 1). Injected for tests; defaults to Math.random.
   * Ignored when temperature <= 0 (deterministic argmax).
   */
  random?: () => number;
};

/** Numerically stable softmax. Entries that are -Infinity become 0. */
export function stableSoftmax(logits: ArrayLike<number>): Float64Array {
  const n = logits.length;
  const out = new Float64Array(n);
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    const v = Number(logits[i]);
    if (v > max) max = v;
  }
  if (!Number.isFinite(max)) {
    return out;
  }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = Number(logits[i]);
    if (!Number.isFinite(v)) {
      out[i] = 0;
      continue;
    }
    const e = Math.exp(v - max);
    out[i] = e;
    sum += e;
  }
  if (sum <= 0) return out;
  for (let i = 0; i < n; i++) out[i]! /= sum;
  return out;
}

/** Deterministic argmax; ties break toward the lowest index. */
export function argmax(logits: ArrayLike<number>): number {
  let bestIdx = 0;
  let bestVal = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < logits.length; i++) {
    const v = Number(logits[i]);
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function sampleCategorical(
  probs: ArrayLike<number>,
  random: () => number,
): number {
  let r = random();
  if (!(r >= 0 && r < 1)) r = 0;
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += Number(probs[i]);
    if (r < acc) return i;
  }
  // Floating-point tail: last positive mass.
  for (let i = probs.length - 1; i >= 0; i--) {
    if (Number(probs[i]) > 0) return i;
  }
  return 0;
}

/**
 * Sample a vocabulary index from masked logits.
 * `temperature <= 0` ⇒ deterministic argmax (used by parity tests).
 */
export function sampleFromLogits(
  logits: ArrayLike<number>,
  options: SampleOptions,
): number {
  const temperature = options.temperature;
  if (temperature <= 0) {
    return argmax(logits);
  }

  const scaled = new Float64Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    const v = Number(logits[i]);
    scaled[i] = Number.isFinite(v) ? v / temperature : v;
  }
  const probs = stableSoftmax(scaled);
  const random = options.random ?? Math.random;

  if (options.topP < 1) {
    // Match upstream: keep while cumsum <= top_p, always keep top-1.
    const order = Array.from({ length: probs.length }, (_, i) => i);
    order.sort((a, b) => Number(probs[b]) - Number(probs[a]));

    const kept: number[] = [];
    const keptProbs: number[] = [];
    let cumulative = 0;
    for (let k = 0; k < order.length; k++) {
      const idx = order[k]!;
      const p = Number(probs[idx]);
      if (p <= 0 && k > 0) break;
      cumulative += p;
      if (k > 0 && cumulative > options.topP) break;
      kept.push(idx);
      keptProbs.push(p);
    }
    if (kept.length === 0) {
      kept.push(order[0]!);
      keptProbs.push(Number(probs[order[0]!]));
    }

    let sum = 0;
    for (const p of keptProbs) sum += p;
    const renormalized = keptProbs.map((p) => (sum > 0 ? p / sum : 0));
    const choice = sampleCategorical(renormalized, random);
    return kept[choice]!;
  }

  return sampleCategorical(probs, random);
}

/** Top-k (index, probability) pairs after softmax on masked logits. */
export function topKFromLogits(
  logits: ArrayLike<number>,
  k: number,
): Array<{ index: number; probability: number }> {
  const probs = stableSoftmax(logits);
  const order = Array.from({ length: probs.length }, (_, i) => i);
  order.sort((a, b) => Number(probs[b]) - Number(probs[a]));
  const out: Array<{ index: number; probability: number }> = [];
  for (let i = 0; i < order.length && out.length < k; i++) {
    const index = order[i]!;
    const probability = Number(probs[index]);
    if (probability <= 0) break;
    out.push({ index, probability });
  }
  return out;
}
