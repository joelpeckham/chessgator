import type { OpeningRecord } from "./data";

const ECO_FAMILY: Record<string, string> = {
  A: "ECO A covers irregular and flank openings—systems that skip the main e4/d4 fight early.",
  B: "ECO B covers semi-open games after 1. e4 where Black does not reply …e5.",
  C: "ECO C covers open games (1. e4 e5) and several 1. e4 defenses such as the French and Caro-Kann.",
  D: "ECO D covers queen-pawn games and closed structures, including many Gambits and the Queen's Gambit complex.",
  E: "ECO E covers Indian defenses and related systems where Black fianchettoes or pressures the center from the flanks.",
};

const FIRST_MOVE_NOTE: Record<string, string> = {
  e4: "White stakes a claim in the center and opens lines for the bishop and queen.",
  d4: "White builds a pawn center and keeps the position more closed than after 1. e4.",
  c4: "White controls d5 without committing the d-pawn—the English family.",
  Nf3: "White develops a knight and keeps flexible transpositions into d4 or c4 setups.",
  Nc3: "White develops the queen's knight while leaving central pawn breaks open.",
  g3: "White prepares a kingside fianchetto and flexible central play.",
  b3: "White prepares a queenside fianchetto, often transposing into Reti or English structures.",
  f4: "White contests the center aggressively from the flank—the Bird family.",
  g4: "White pushes the g-pawn early, aiming for kingside space at the cost of king safety.",
  b4: "White gains queenside space immediately—the Sokolsky / Polish family.",
  h4: "White pushes the rook pawn early, a rare choice that aims for kingside space.",
  a4: "White gains queenside space with the a-pawn, keeping the center flexible.",
  e3: "White keeps the center flexible, often transposing into reversed French or Colle setups.",
  f3: "White prepares a delayed central push or a kingside fianchetto from an unusual move order.",
  a3: "White makes a useful waiting move on the queenside before committing the center.",
};

function ecoLetter(eco: string): string {
  return eco.charAt(0).toUpperCase();
}

/** Short, template copy from ECO family and first moves—no invented theory. */
export function openingIdeas(opening: OpeningRecord): string {
  const letter = ecoLetter(opening.eco);
  const family =
    ECO_FAMILY[letter] ?? "This line is classified in the ECO encyclopedia.";
  const first = opening.firstMove;
  const firstNote =
    FIRST_MOVE_NOTE[first] ??
    (first
      ? `The sequence begins with ${formatMoveList(opening.moves.slice(0, Math.min(4, opening.moves.length)))}.`
      : "Study the move order below to see how the position arises.");

  const plyCount = opening.moves.length;
  const depth =
    plyCount <= 2
      ? "This entry names the opening after the first moves."
      : plyCount <= 6
        ? "The variation is defined by a short, recognizable move order."
        : "This entry tracks a longer branch in the opening tree.";

  return `${family} ${firstNote} ${depth} Use the diagram and SAN list to recognize the tabiya, then try the line against Maia to explore typical plans in practice.`;
}

function formatMoveList(moves: readonly string[]): string {
  let text = "";
  for (let i = 0; i < moves.length; i += 1) {
    const moveNumber = Math.floor(i / 2) + 1;
    if (i % 2 === 0) text += `${moveNumber}. `;
    text += moves[i] ?? "";
    if (i < moves.length - 1) text += " ";
  }
  return text.trim();
}

export function openingDescription(opening: OpeningRecord): string {
  const moves = opening.moves.join(" ");
  return `${opening.name} (${opening.eco}): ${moves}. ECO opening from the Lichess CC0 encyclopedia.`;
}
