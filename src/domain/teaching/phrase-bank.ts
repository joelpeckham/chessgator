/**
 * Deterministic surface variants per reason kind. Index 0 is the canonical
 * phrasing; later entries are hashed by game node id via `pickVariant`.
 * Authored offline (including Luna drafts); never generated at runtime.
 */
export const PHRASE_BANK = {
  castle: [
    "it gets your king out of danger and activates your rook",
    "your king tucks away and the rook comes into the game",
    "it gives your king shelter and brings your rook closer to the center",
  ],
  king_safer: [
    "it keeps your king safer",
    "your king is harder to attack",
    "it gives your king better protection",
  ],
  center_control: [
    "you control more central squares",
    "you claim more of the center",
    "you put more pressure on the center",
  ],
  discovered_check: [
    "it discovers check",
    "it reveals an attack on the king",
    "it opens a line to the king",
  ],
  check: [
    "it puts the opponent in check",
    "it forces the king to respond",
    "it attacks the king directly",
  ],
  king_more_exposed: [
    "your king is more open to attack",
    "it leaves your king with fewer defenders",
    "your king has less shelter",
  ],
  back_rank: [
    "your king can get caught on the back rank",
    "your king has too little room on the back rank",
    "the back rank can become a serious weakness",
  ],
  passed_pawn: [
    "it creates a passed pawn",
    "it gives you a passed pawn",
    "it leaves you with a passed pawn",
  ],
  doubled_pawns: [
    "it doubles your pawns",
    "it leaves you with doubled pawns",
    "it puts two pawns on the same file",
  ],
  isolated_pawn: [
    "it leaves you with an isolated pawn",
    "it gives you an isolated pawn",
    "it leaves one pawn without support from its neighbors",
  ],
  open_file: [
    "your rook gets an open file",
    "your rook can use an open file",
    "it gives your rook an open file",
  ],
  semi_open_file: [
    "your rook gets a semi-open file",
    "your rook can use a semi-open file",
    "it gives your rook a semi-open file",
  ],
  rook_on_seventh: [
    "your rook reaches the seventh rank",
    "your rook gets onto the seventh rank",
    "it puts your rook on the seventh rank",
  ],
  outpost: [
    "your knight settles on an outpost",
    "your knight finds a secure outpost",
    "it gives your knight a strong outpost",
  ],
  backward_pawn: [
    "it leaves you with a backward pawn",
    "it gives you a backward pawn",
  ],
  pawn_shield: [
    "it weakens the pawns in front of your king",
    "it leaves your king with a weaker pawn shield",
    "your king has less pawn cover",
  ],
  mobility: [
    "your pieces control more squares",
    "your pieces have more available squares",
    "it gives your pieces more room to move",
  ],
  only_move: [
    "it is the only move that holds",
    "it is the only way to keep the position together",
    "no other move solves the problem",
  ],
  still_winning: [
    "you are still winning, but this makes it harder",
    "you keep the advantage, but the win is less clear",
    "you remain ahead, though the position is tougher",
  ],
  hands_advantage: [
    "this hands the opponent the advantage",
    "this gives the opponent the better position",
    "this lets the opponent take over",
  ],
  stronger_position: [
    "it keeps a stronger position",
    "it preserves the better position",
    "it maintains your positional edge",
  ],
  problem_king_more_exposed: [
    "makes your king easier to attack",
    "leaves your king with less protection",
    "gives the opponent more access to your king",
  ],
  problem_back_rank: [
    "leaves your king trapped on the back rank",
    "gives your king too little room on the back rank",
    "makes the back rank a dangerous weakness",
  ],
  problem_backward_pawn: [
    "leaves you with a backward pawn",
    "creates a backward pawn to defend",
    "gives you a backward pawn",
  ],
  problem_pawn_shield: [
    "weakens the pawns in front of your king",
    "leaves your king with less pawn cover",
    "makes your king's pawn cover weaker",
  ],
  problem_doubled_pawns: [
    "doubles your pawns",
    "leaves you with doubled pawns",
    "creates doubled pawns that are harder to use",
  ],
  problem_isolated_pawn: [
    "leaves you with an isolated pawn",
    "creates an isolated pawn to defend",
    "gives you a pawn without support",
  ],
} as const;

export type PhraseBankKey = keyof typeof PHRASE_BANK;
