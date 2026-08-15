/**
 * Legal-move masking over the Maia3 4352-move vocabulary via chess.js.
 */
import { getLegalMoves } from "@/domain/game/rules";
import { toVocabUci } from "@/engines/maia/encode";
import { getMoveIndexMap, MOVE_VOCAB_SIZE } from "@/engines/maia/vocabulary";

/** Boolean mask of length 4352; true = legal in `fen`. */
export function legalMovesMask(fen: string): Uint8Array {
  const mask = new Uint8Array(MOVE_VOCAB_SIZE);
  const indexMap = getMoveIndexMap();
  for (const move of getLegalMoves(fen)) {
    const vocabUci = toVocabUci(fen, move.uci);
    const idx = indexMap.get(vocabUci);
    if (idx !== undefined) {
      mask[idx] = 1;
    }
  }
  return mask;
}

/** Apply -Infinity to illegal logits (mutates a copy). */
export function applyLegalMask(
  logits: ArrayLike<number>,
  mask: Uint8Array,
): Float64Array {
  const out = new Float64Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    out[i] = mask[i] ? Number(logits[i]) : Number.NEGATIVE_INFINITY;
  }
  return out;
}
