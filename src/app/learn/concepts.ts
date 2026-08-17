import { isValidFenString } from "@/lib/fen-from-moves";
import type { GameColor } from "@/lib/game-href";

export type ConceptCategory = "tactics" | "mates" | "positional" | "endgames";

export type Concept = {
  slug: string;
  title: string;
  category: ConceptCategory;
  /** Search / Open Graph description. */
  description: string;
  /** Answer-first definition; first sentence on the page. */
  definition: string;
  paragraphs: readonly string[];
  fen: string;
  highlights: readonly string[];
  boardTitle: string;
  color: GameColor;
};

export const CATEGORY_LABEL: Record<ConceptCategory, string> = {
  tactics: "Tactics",
  mates: "Checkmates",
  positional: "Positional ideas",
  endgames: "Endgames",
};

export const CATEGORY_ORDER: readonly ConceptCategory[] = [
  "tactics",
  "mates",
  "positional",
  "endgames",
];

export const CONCEPTS: readonly Concept[] = [
  {
    slug: "pin",
    title: "Pin",
    category: "tactics",
    description:
      "A pin freezes a piece on a line because moving it would expose a more valuable piece behind it.",
    definition:
      "A pin is a line attack that freezes a piece because moving it would expose a more valuable piece behind it.",
    paragraphs: [
      "If the piece at the back is the king, the pin is absolute: the front piece is illegal to move. If the piece at the back is a queen or rook, the pin is relative — you can move the front piece, but you will usually drop material.",
      "In the diagram, Re1 lines the rook up with the knight and the king. The knight cannot step away without leaving the king in check, so White can pile on e7 or simply keep the piece out of the game.",
      "When the coach flags a pin during a game, look at the whole line, not just the two pieces that are touching. The winning idea is often to attack the pinned piece a second time.",
    ],
    fen: "4k3/4n3/8/8/8/8/8/R6K w - - 0 1",
    highlights: ["a1", "e1", "e7", "e8"],
    boardTitle: "White to play Re1, pinning the knight to the king",
    color: "white",
  },
  {
    slug: "fork",
    title: "Fork",
    category: "tactics",
    description:
      "A fork is one move that attacks two or more enemy pieces at the same time.",
    definition:
      "A fork is one move that attacks two or more enemy pieces at the same time, so only one of them can be saved.",
    paragraphs: [
      "Knights are the usual forking piece because they jump and change color each move. Pawns, bishops, rooks, queens, and even the king can fork when two targets sit on squares that one piece attacks.",
      "Black plays Nc2+ and hits the king and the queen together. White must step out of check and the queen falls. A fork that includes the king is the most forcing kind, because the reply is not optional.",
      "If you leave two loose pieces on knight hops from the same square, the coach will treat that as a fork waiting to happen.",
    ],
    fen: "4k3/8/8/8/3Q4/n7/8/4K3 b - - 0 1",
    highlights: ["a3", "c2", "d4", "e1"],
    boardTitle: "Black to play Nc2+, forking king and queen",
    color: "black",
  },
  {
    slug: "skewer",
    title: "Skewer",
    category: "tactics",
    description:
      "A skewer attacks a valuable piece so that when it moves, a piece behind it can be taken.",
    definition:
      "A skewer is a line attack through a valuable piece, so that when it steps aside a piece behind it can be taken.",
    paragraphs: [
      "It is the reverse of a pin. In a pin the cheaper piece stands in front. In a skewer the dearer piece stands in front and is forced to move, leaving the rear piece hanging.",
      "Re1+ checks the king on e2. The king must step off the e-file, and the rook on e8 is then unprotected. Checks that slide through the king are the cleanest skewers.",
      "Bishops and queens skewer on diagonals the same way. If your king and a rook share a line with an enemy slider, assume the skewer is real until you block the line.",
    ],
    fen: "4r3/8/8/8/8/8/4k3/R6K w - - 0 1",
    highlights: ["a1", "e1", "e2", "e8"],
    boardTitle: "White to play Re1+, skewering the king and rook",
    color: "white",
  },
  {
    slug: "discovered-attack",
    title: "Discovered attack",
    category: "tactics",
    description:
      "A discovered attack is an attack revealed when you move a piece out of the way of a bishop, rook, or queen.",
    definition:
      "A discovered attack happens when you move one piece out of the way and uncover an attack from a bishop, rook, or queen behind it.",
    paragraphs: [
      "The piece that moves can go anywhere useful: a capture, a second attack, or a quiet square. The damage is done by the piece that was hiding.",
      "The bishop on a2 is aimed at the queen on g8, with the knight sitting on the diagonal. Any knight move uncovers the bishop. Ne7 is one way to step off that line and leave the queen hanging.",
      "Before you move a piece that sits on a long line, glance behind it. If a slider would then hit a king or queen, you are looking at a discovery.",
    ],
    fen: "6qk/8/8/3N4/8/8/B7/4K3 w - - 0 1",
    highlights: ["a2", "d5", "g8"],
    boardTitle: "White knight on d5 masks a bishop attack on the queen",
    color: "white",
  },
  {
    slug: "discovered-check",
    title: "Discovered check",
    category: "tactics",
    description:
      "A discovered check is a check revealed by moving a piece off the line of a rook, bishop, or queen.",
    definition:
      "A discovered check is a discovered attack that puts the enemy king in check.",
    paragraphs: [
      "Because the king is in check, the opponent must stop the newly opened line. The piece that moved is often free to take material on that same turn — the opponent cannot capture it unless that also blocks the check.",
      "The rook on d1 faces the king on d8. Ne4 steps off the file and the rook checks. Black has to deal with the rook, not with the knight.",
      "If the moving piece also gives check, the position becomes a double check, which is even harder to meet.",
    ],
    fen: "3k4/8/8/8/8/8/3N4/3RK3 w - - 0 1",
    highlights: ["d1", "d2", "d8"],
    boardTitle: "White to play Ne4, discovering check from the rook",
    color: "white",
  },
  {
    slug: "double-check",
    title: "Double check",
    category: "tactics",
    description:
      "A double check is a check from two pieces at once, and it can only be met by moving the king.",
    definition:
      "A double check is a check given by two pieces at once, usually a discovered check plus a check from the piece that moved.",
    paragraphs: [
      "You cannot block two lines with one piece, and you cannot capture two checkers unless they happen to sit on the same square. The king has to move.",
      "Nf7+ checks with the knight, and the rook on e2 is uncovered at the same time. Black cannot take the knight or interpose on the e-file; those replies stop only one of the checks.",
      "Double checks are common near the king in open positions. If a discovery is available, look for a landing square that also attacks the king.",
    ],
    fen: "4k3/8/8/4N3/8/8/4R3/4K3 w - - 0 1",
    highlights: ["e2", "e5", "e8", "f7"],
    boardTitle: "White to play Nf7+, a double check",
    color: "white",
  },
  {
    slug: "overload",
    title: "Overload",
    category: "tactics",
    description:
      "A piece is overloaded when it must defend two things and cannot cover both after you strike one of them.",
    definition:
      "A piece is overloaded when it has to defend two things at once and cannot cover both after you attack one of them.",
    paragraphs: [
      "The usual pair is a hanging piece plus a mate square, or two hanging pieces. You take the first target; if the overloaded piece recaptures, the second target falls.",
      "The rook on d8 defends the knight on d5 and also watches e8. Qxd5 asks the rook to choose. Recapturing leaves the back rank empty, and Re8 is mate.",
      "When a single piece is the only guard of two important squares, it is a candidate for overload even if both squares look safe right now.",
    ],
    fen: "3r2k1/5ppp/8/3n4/4Q3/8/5PPP/4R1K1 w - - 0 1",
    highlights: ["d5", "d8", "e4", "e8"],
    boardTitle: "The black rook is overloaded: it defends d5 and the back rank",
    color: "white",
  },
  {
    slug: "deflection",
    title: "Deflection",
    category: "tactics",
    description:
      "Deflection forces a defending piece off the square or line where it was doing useful work.",
    definition:
      "Deflection is forcing a defending piece off the square or line where it was doing useful work.",
    paragraphs: [
      "A check or a capture on a new square can pull the defender away. Once it has left, the original target is no longer guarded.",
      "Ra8+ forces the queen on f7 to interpose on e8 or f8. Either way it leaves f7, and White’s queen can use that file. The rook did not win material by itself; it moved the defender.",
      "Deflection is close to decoy. The difference is the goal: deflection cares about the square the piece left, not the square it landed on.",
    ],
    fen: "6k1/5qpp/8/8/8/8/5QPP/R5K1 w - - 0 1",
    highlights: ["a1", "a8", "f2", "f7"],
    boardTitle: "White to play Ra8+, deflecting the queen from f7",
    color: "white",
  },
  {
    slug: "decoy",
    title: "Decoy",
    category: "tactics",
    description:
      "A decoy is a forcing move that lures a piece onto a square where it can be exploited.",
    definition:
      "A decoy is a forcing move that lures a piece onto a square where it can be exploited.",
    paragraphs: [
      "The lure is often a check or a sacrifice. The opponent takes because the alternative is worse, and the piece that captured is then forked, pinned, or mated.",
      "Re7+ offers the rook. If the queen takes, the knight on c6 recaptures a queen for a rook. If the king flees to f8, you have still dragged a defender off d8 and e8.",
      "Decoy and attraction overlap. Use decoy when the point is “I needed that piece to stand on this exact square.”",
    ],
    fen: "3qk3/8/2N5/8/8/8/4R3/4K3 w - - 0 1",
    highlights: ["c6", "d8", "e2", "e7", "e8"],
    boardTitle: "White to play Re7+, decoying the queen or king to e7",
    color: "white",
  },
  {
    slug: "removal-of-the-guard",
    title: "Removal of the guard",
    category: "tactics",
    description:
      "Removal of the guard is capturing or driving off the piece that defends a target.",
    definition:
      "Removal of the guard is capturing or driving off the piece that defends a target, so the target can be taken.",
    paragraphs: [
      "If a bishop is only safe because a knight defends it, taking the knight leaves the bishop hanging. The same idea works against a mate-square defender: remove the guard, then mate.",
      "The knight on c6 is the only protection for the bishop on d5. Qxc6 takes the guard. After that, d5 is no longer defended and the bishop can be collected.",
      "Count defenders before you capture. If you and the opponent have the same number of attackers and defenders, removing one guard tips the trade.",
    ],
    fen: "6k1/5ppp/2n5/3b4/8/2Q5/5PPP/6K1 w - - 0 1",
    highlights: ["c3", "c6", "d5"],
    boardTitle: "White to play Qxc6, removing the bishop’s only guard",
    color: "white",
  },
  {
    slug: "zwischenzug",
    title: "Zwischenzug",
    category: "tactics",
    description:
      "A zwischenzug is an in-between move played before the recapture the position seemed to require.",
    definition:
      "A zwischenzug is an in-between move that you play before the recapture or reply the position seemed to require.",
    paragraphs: [
      "The expected move is still there a ply later. You insert a check, a stronger capture, or a threat that the opponent must answer first, then you take back.",
      "White has just captured on d5. Recapturing with the bishop is the obvious reply. Bb4+ is the in-between move: it checks, White must deal with the king, and only then does the bishop situation get resolved — often on better terms.",
      "The coach uses this word when you (or Maia) skip a recapture to give a check. If the check is real, the recapture will still be available.",
    ],
    fen: "4k3/8/8/2bN4/8/8/8/4K3 b - - 0 1",
    highlights: ["b4", "c5", "d5", "e1"],
    boardTitle: "Black to play Bb4+ before recapturing on d5",
    color: "black",
  },
  {
    slug: "sacrifice",
    title: "Sacrifice",
    category: "tactics",
    description:
      "A sacrifice is giving up material on purpose to gain an attack, a tactic, or a better position.",
    definition:
      "A sacrifice is giving up material on purpose to gain an attack, a tactic, or a better position.",
    paragraphs: [
      "The offer is sound when the follow-up wins the material back with interest, or when the king cannot survive. It is a blunder when there is no follow-up.",
      "Bxh7+ is the Greek gift: the bishop takes the h-pawn with check. If the king accepts, a knight and queen can join on the kingside. The bishop is not hanging in the usual sense — it was spent to open the king.",
      "Not every capture on h7 is this idea. You still need a way to bring a knight to g5 and a queen to h5 or the long diagonal. The diagram is the pattern, not a promise that every such position wins.",
    ],
    fen: "rnbq1rk1/ppp2ppp/3bpn2/3p4/2PP4/2NBP3/PP3PPP/R1BQK1NR w KQ - 3 6",
    highlights: ["d3", "h7", "g8"],
    boardTitle: "White can play Bxh7+, a classic bishop sacrifice",
    color: "white",
  },
  {
    slug: "attraction",
    title: "Attraction",
    category: "tactics",
    description:
      "Attraction forces a piece, often the king or a rook, onto a square where a follow-up tactic works.",
    definition:
      "Attraction is forcing a piece, often the king, onto a specific square so a follow-up tactic works.",
    paragraphs: [
      "The first move looks like a sacrifice. The second move only exists because the piece now stands on the new square — a fork, a smothered mate, or a discovered check.",
      "Qg8+ is protected by the knight on h6, so the king cannot take. The rook is attracted to g8. After Rxg8, Nf7 is smothered mate. The queen was spent to put the rook on the square that boxes the king in.",
      "If you are calculating a mate and one enemy piece is on the wrong square, ask whether a check can drag it there.",
    ],
    fen: "5r1k/6pp/7N/8/2Q5/8/8/4K3 w - - 0 1",
    highlights: ["c4", "g8", "h6", "h8", "f8"],
    boardTitle: "White to play Qg8+, attracting the rook to g8",
    color: "white",
  },
  {
    slug: "interference",
    title: "Interference",
    category: "tactics",
    description:
      "Interference blocks the line between a defender and what it defends by occupying a square on that line.",
    definition:
      "Interference is putting a piece on the line between a defender and what it defends, so the defense cannot get through.",
    paragraphs: [
      "Rooks need a clear file, bishops a clear diagonal. A single unit dropped on that line cuts the connection. The interfering piece does not have to capture anything.",
      "The rook on a8 defends the bishop on a2. Na5 steps onto the a-file. The rook no longer sees a2, and Rxa2 wins the bishop.",
      "Interference also appears as a defensive idea: you can step onto a checking line with a piece that also attacks something, so the opponent cannot take for free.",
    ],
    fen: "r5k1/5ppp/8/8/2N5/8/b4PPP/R5K1 w - - 0 1",
    highlights: ["a1", "a2", "a5", "a8", "c4"],
    boardTitle: "White to play Na5, interfering with the rook’s defense of a2",
    color: "white",
  },
  {
    slug: "x-ray",
    title: "X-ray",
    category: "tactics",
    description:
      "An x-ray is an attack or defense that operates through an enemy piece along a file, rank, or diagonal.",
    definition:
      "An x-ray is an attack or defense that operates through an enemy piece along a file, rank, or diagonal.",
    paragraphs: [
      "The slider “sees through” the unit in the middle. When that unit moves or is captured, the piece at the far end is suddenly attacked or defended.",
      "The queen on d1 looks through the knight on d6 at the rook on d8. The knight is a screen, not a shield. If it leaves the file, the rook is hit; if it is captured, the queen recaptures on the same line.",
      "Doubled rooks x-ray each other through an enemy piece in between. That is why lining heavy pieces on an open file stays useful even when something sits in the way.",
    ],
    fen: "3r2k1/5ppp/3n4/8/8/8/5PPP/3Q2K1 w - - 0 1",
    highlights: ["d1", "d6", "d8"],
    boardTitle: "White’s queen x-rays the rook through the knight on d6",
    color: "white",
  },
  {
    slug: "windmill",
    title: "Windmill",
    category: "tactics",
    description:
      "A windmill is a repeating discovered check that picks up material on each swing.",
    definition:
      "A windmill is a repeating discovered check, usually a rook swinging off a bishop’s diagonal, that picks up material each time.",
    paragraphs: [
      "The bishop stays fixed, aimed at the king. The rook checks, then steps off the diagonal to capture, then returns to check again. The king is stuck in the pattern until the captures run out.",
      "Rxg7 starts it. The bishop on e5 aims at h8 through g7. After the rook takes, it can slide along the seventh rank with discovered checks and come back to g7.",
      "Windmills are rare in quiet games and common in puzzles. If you ever get a rook to the seventh with a bishop on the long diagonal, look for the loop before you take a single pawn and stop.",
    ],
    fen: "r6k/p4Rpp/8/4B3/8/8/5PPP/6K1 w - - 0 1",
    highlights: ["e5", "f7", "g7", "h8"],
    boardTitle: "White to play Rxg7, starting a windmill on the seventh rank",
    color: "white",
  },
  {
    slug: "back-rank-mate",
    title: "Back-rank mate",
    category: "mates",
    description:
      "A back-rank mate is checkmate on the last rank when the king is trapped behind its own pawns.",
    definition:
      "A back-rank mate is checkmate on the eighth (or first) rank when the king is trapped behind its own pawns.",
    paragraphs: [
      "The pawns that keep the king safe from checks in front also take away its flight squares. A rook or queen on the back rank then mates because the king has nowhere to step and no piece can block on that rank.",
      "Ra8# is the whole idea. The king on g8 is boxed by f7, g7, and h7. There is no luft — a flight square created by moving a pawn to h6 or a6.",
      "The coach warns about the back rank when your king has no luft and the opponent has a rook that can reach the eighth. One pawn move, or a rook left at home, is usually enough to prevent it.",
    ],
    fen: "6k1/5ppp/8/8/8/8/8/R6K w - - 0 1",
    highlights: ["a1", "a8", "f8", "g8", "h8"],
    boardTitle: "White to play Ra8#, a back-rank mate",
    color: "white",
  },
  {
    slug: "smothered-mate",
    title: "Smothered mate",
    category: "mates",
    description:
      "A smothered mate is checkmate by a knight when the king’s own pieces take away all flight squares.",
    definition:
      "A smothered mate is checkmate by a knight when the king’s own pieces take away all of its flight squares.",
    paragraphs: [
      "The knight does not need help from another attacking piece. The king’s own rook and pawns do the trapping. That is why the mate is so short: there is no square to run to and nothing can capture the knight.",
      "Nf7# lands next to a king on h8 that is sealed in by the rook on g8 and the pawns on g7 and h7. The knight is safe from the king, and no other black piece attacks f7.",
      "The usual route to this mate is a queen check that attracts a rook to g8, then the knight hop. The attraction page shows that first half; this page is the finish.",
    ],
    fen: "6rk/6pp/8/6N1/8/8/8/4K3 w - - 0 1",
    highlights: ["f7", "g5", "g7", "g8", "h7", "h8"],
    boardTitle: "White to play Nf7#, a smothered mate",
    color: "white",
  },
  {
    slug: "scholars-mate",
    title: "Scholar's mate",
    category: "mates",
    description:
      "Scholar's mate is a four-move checkmate that aims the queen and bishop at f7.",
    definition:
      "Scholar's mate is a four-move checkmate that aims the queen and bishop at the weak f7 pawn (or f2 for Black).",
    paragraphs: [
      "The typical order is 1.e4 e5 2.Qh5 Nc6 3.Bc4, threatening Qxf7. If Black develops the kingside knight and ignores f7, the queen takes with mate because the bishop covers that square.",
      "Qxf7# is available here. The queen is protected by the bishop on c4, so the king cannot capture. f7 is the weakest point in the starting position: only the king defends it.",
      "The mate is easy to stop — …g6, …Qe7, or …Nf6 with care for the e5 pawn. chessgator will still name the pattern if someone aims both pieces at f7, because the same idea appears later as a genuine attack, not only as a four-move trap.",
    ],
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    highlights: ["c4", "f7", "h5", "e8"],
    boardTitle: "White to play Qxf7#, scholar's mate",
    color: "white",
  },
  {
    slug: "development",
    title: "Development",
    category: "positional",
    description:
      "Development is bringing pieces off the back rank to squares where they control the center.",
    definition:
      "Development is bringing pieces off the back rank to squares where they control the center and can join the fight.",
    paragraphs: [
      "Knights and bishops should leave the first rank before you start pawn hunts. Castling counts as development for the king and the rook. A lead in development means your pieces are already working while the opponent is still untangling.",
      "White has a knight on f3 and a bishop on c4. Black still has both bishops and the kingside knight at home. The next jobs for Black are …Nf6 or …Bc5, not a third pawn move.",
      "The coach treats a minor piece leaving the back rank as development. If you keep shuffling pawns while Maia brings pieces out, the tactics in this glossary start to appear against you.",
    ],
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    highlights: ["c4", "f3", "b8", "g8"],
    boardTitle: "White has developed two pieces; Black to catch up",
    color: "black",
  },
  {
    slug: "king-safety",
    title: "King safety",
    category: "positional",
    description:
      "King safety is how well the king is sheltered from checks and mating nets.",
    definition:
      "King safety is how well the king is sheltered from checks and mating nets, usually by castling and a sound pawn shield.",
    paragraphs: [
      "A king in the center is safe while the files are closed. Once the d- or e-file opens, every check becomes a problem. Castling tucks the king behind three pawns and connects the rooks.",
      "White has already castled. Black’s king is still on e8, and the d-file is opening around the pawn on d4. Black can still castle, and should, before the center is fully cleared.",
      "King safety is also about the pawn cover after you castle. Pushing the g- or h-pawn makes luft against back-rank mates, but it also gives the opponent hook squares for an attack.",
    ],
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b5/2BpP3/2P2N2/PP3PPP/RNBQ1RK1 b kq - 1 6",
    highlights: ["e8", "g1", "d4", "e4"],
    boardTitle: "White is castled; Black’s king is still in the center",
    color: "black",
  },
  {
    slug: "center-control",
    title: "Center control",
    category: "positional",
    description:
      "Center control is occupying or attacking d4, d5, e4, and e5 so your pieces have more room.",
    definition:
      "Center control is occupying or attacking the d4, d5, e4, and e5 squares so your pieces have more room than the opponent’s.",
    paragraphs: [
      "Pawns on d4 and e4 claim space and keep enemy pieces off those squares. Knights on f3 and c3 support the same idea. You do not have to occupy every central square; attacking them is enough.",
      "This is the Scotch: White has played d4 against …e5. The e5 pawn is challenged, and if Black takes, White recaptures toward the center and opens lines for the bishops.",
      "A side that gives up the center without pressure on it often ends up cramped. The space page is the longer-term version of the same fight.",
    ],
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3",
    highlights: ["d4", "d5", "e4", "e5"],
    boardTitle: "White challenges the center with d4 in the Scotch",
    color: "black",
  },
  {
    slug: "passed-pawn",
    title: "Passed pawn",
    category: "positional",
    description:
      "A passed pawn has no enemy pawn in front of it or on an adjacent file.",
    definition:
      "A passed pawn is a pawn with no enemy pawn in front of it or on an adjacent file, so nothing can step in its way.",
    paragraphs: [
      "Enemy pieces can still block or capture it, but no pawn can. That is why passers grow stronger as pieces come off: the king and a rook have to babysit a square that a pawn would have covered for free.",
      "The pawn on d5 has a clear road. Black’s only pawn is on f7, two files away. White’s job is to escort d5; Black’s job is to blockade it, ideally with the king or a knight.",
      "Creating a passer — by trading the last enemy pawn on neighboring files — is a common winning plan the coach will name in the endgame.",
    ],
    fen: "4k3/5p2/8/3P4/8/8/5P2/4K3 w - - 0 1",
    highlights: ["d5", "d6", "d7", "d8"],
    boardTitle: "White’s d-pawn is passed",
    color: "white",
  },
  {
    slug: "isolated-pawn",
    title: "Isolated pawn",
    category: "positional",
    description:
      "An isolated pawn has no friendly pawn on either neighboring file.",
    definition:
      "An isolated pawn has no friendly pawn on either neighboring file, so it cannot be protected by another pawn.",
    paragraphs: [
      "The isolated queen’s pawn (IQP) on d4 is the textbook case. It grants space and open files for the pieces, and it is also a fixed target that Black can blockade on d5.",
      "White has no c-pawn and no e-pawn. The d4 pawn must be guarded by pieces. Black’s c5 pawn attacks it, which is the usual way to pressure an IQP.",
      "Whether the pawn is a strength or a weakness depends on the pieces. If White’s knights and rooks are active, the extra space matters. If they get traded, the ending is often just a weak pawn.",
    ],
    fen: "r2q1rk1/pp3ppp/2n1pn2/2p5/3P4/2N1BN2/PP3PPP/R2Q1RK1 w - - 0 12",
    highlights: ["c5", "d4"],
    boardTitle: "White’s d4 pawn is isolated",
    color: "white",
  },
  {
    slug: "doubled-pawns",
    title: "Doubled pawns",
    category: "positional",
    description:
      "Doubled pawns are two friendly pawns stacked on the same file.",
    definition:
      "Doubled pawns are two friendly pawns stacked on the same file, which makes them less mobile and often easier to attack.",
    paragraphs: [
      "The front pawn blocks the back one. They cannot defend each other, and the file they sit on is usually half-open for the opponent’s rooks.",
      "After the exchange on c6 in the Ruy Lopez, Black has pawns on c7 and c6. The extra c-pawn toward the center is not useless — it helps hold d5 — but the a- and c-pawns are a long-term structure White can play against.",
      "Doubled pawns are acceptable when they open a file for your own rook or control key squares. They are a problem when they are isolated as well as doubled.",
    ],
    fen: "r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
    highlights: ["c6", "c7"],
    boardTitle: "Black’s c-pawns are doubled after Bxc6",
    color: "white",
  },
  {
    slug: "backward-pawn",
    title: "Backward pawn",
    category: "positional",
    description:
      "A backward pawn cannot be guarded by neighboring pawns and cannot safely advance.",
    definition:
      "A backward pawn cannot be guarded by neighboring pawns and cannot safely advance because the square in front of it is controlled by the opponent.",
    paragraphs: [
      "The pawn sits behind its neighbors. The hole in front of it is a square the opponent can occupy. You spend pieces defending a pawn that cannot easily step forward.",
      "In the Open Sicilian, d6 is the usual backward pawn. White’s e4 pawn (and a knight on d4 or b5) makes …d5 hard to achieve. Until that break works, Black’s queen and rook often stay tied to d6.",
      "The cure is the pawn break that frees it — here, …d5 — or a piece blockade swap that trades the weak pawn off. Sitting behind it forever is how the weakness is milked.",
    ],
    fen: "rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5",
    highlights: ["d6", "d5", "e4"],
    boardTitle: "Black’s d6 pawn is backward in the Open Sicilian",
    color: "black",
  },
  {
    slug: "outpost",
    title: "Outpost",
    category: "positional",
    description:
      "An outpost is a square a piece can occupy without being driven off by a pawn.",
    definition:
      "An outpost is a square, usually in the opponent’s half, that a piece can occupy without being driven off by a pawn.",
    paragraphs: [
      "Knights love outposts. A knight on d5 or f5, supported by a pawn and safe from …c6 or …e6, is worth as much as a minor piece plus a headache.",
      "White’s knight sits on d5. Black has no c-pawn or e-pawn that can kick it. Trading a bishop for that knight is often Black’s only way to remove it, which is already a small success for White.",
      "If you can force the opponent to create a hole — for example by making them play …e5 or …c5 and leave d5 empty — you have invented an outpost.",
    ],
    fen: "r1bq1rk1/pp3pbp/2n3p1/3N4/8/4BN2/PPP2PPP/R2Q1RK1 w - - 0 1",
    highlights: ["d5"],
    boardTitle: "White’s knight occupies an outpost on d5",
    color: "white",
  },
  {
    slug: "open-file",
    title: "Open file",
    category: "positional",
    description:
      "An open file is a file with no pawns on it, and it is the natural home for rooks.",
    definition:
      "An open file is a file with no pawns on it, and it is the natural home for rooks.",
    paragraphs: [
      "Rooks need room. On a closed file they stare at their own pawns. On an open file they can reach the seventh rank, trade, or swing to the other wing.",
      "The d-file has no pawns. Both sides have already connected their rooks. The first one to seize d1–d8, or to double on it, owns the file.",
      "A semi-open file — only the opponent’s pawn still on it — is also useful. You pressure that pawn; if it takes or advances, the file opens fully.",
    ],
    fen: "r4rk1/pp3ppp/2n1pn2/8/8/2N1PN2/PP3PPP/R4RK1 w - - 0 1",
    highlights: ["d1", "d8", "a1", "f1"],
    boardTitle: "The d-file is open for the rooks",
    color: "white",
  },
  {
    slug: "rook-on-seventh",
    title: "Rook on the seventh",
    category: "positional",
    description:
      "A rook on the seventh rank attacks pawns from the side and can trap the king on the back rank.",
    definition:
      "A rook on the seventh rank (the opponent’s second) attacks pawns from the side and can trap the king on the back rank.",
    paragraphs: [
      "Pawns defend forward. A rook beside them attacks the base of the chain. Two rooks on the seventh often win on the spot because the king is cut off and the pawns fall.",
      "The rook on b7 already hits a7, f7, g7, and h7 and keeps the king on the eighth rank. Black’s rook on e8 is the only piece stopping some back-rank ideas.",
      "Getting there usually means an open file plus an invitation — a weak seventh-rank pawn or a king that has no luft. The open-file and back-rank pages are the setup; this is the payoff.",
    ],
    fen: "4r1k1/1R3ppp/8/8/8/8/5PPP/6K1 w - - 0 1",
    highlights: ["b7", "f7", "g7", "h7"],
    boardTitle: "White’s rook has reached the seventh rank",
    color: "white",
  },
  {
    slug: "pawn-break",
    title: "Pawn break",
    category: "positional",
    description:
      "A pawn break is a pawn advance that challenges the opponent’s pawn chain and opens lines.",
    definition:
      "A pawn break is a pawn advance that challenges the opponent’s pawn chain and opens files or diagonals.",
    paragraphs: [
      "Closed positions stay closed until someone hits a pawn with a pawn. The break is the move that starts the trade. After the dust settles, pieces that were locked in get files and diagonals.",
      "c4 is the Queen’s Gambit break against …d5. White offers a wing pawn to pull Black’s center pawn aside, or to keep a two-pawn center if Black refuses.",
      "In the Sicilian the break is …d5; in the French it is …c5; in the King’s Indian it is …f5 or …c5. The coach names a pawn break when the advance actually challenges a chain, not when you just push a random pawn.",
    ],
    fen: "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
    highlights: ["c2", "c4", "d4", "d5"],
    boardTitle: "White to play c4, the Queen’s Gambit pawn break",
    color: "white",
  },
  {
    slug: "fianchetto",
    title: "Fianchetto",
    category: "positional",
    description:
      "A fianchetto develops a bishop to b2 or g2 after moving the knight’s pawn one square.",
    definition:
      "A fianchetto is developing a bishop to b2 or g2 (or b7 or g7) after moving the knight’s pawn one square.",
    paragraphs: [
      "The bishop sits on the long diagonal and watches the center from the flank. The pawn on g3 (or b3) is both a home for the bishop and a hook the opponent can later attack with h- or a-pawns.",
      "Bg2 is the kingside fianchetto. The bishop looks toward a8 and helps castle. The same pattern on the other wing is b3 and Bb2.",
      "Once you fianchetto, the bishop is often your best piece. Trading it without a good reason leaves holes on the squares it used to cover, especially around a castled king.",
    ],
    fen: "rnbqkbnr/pppp1ppp/8/4p3/8/6P1/PPPPPPBP/RNBQK1NR b KQkq - 1 2",
    highlights: ["g2", "g3"],
    boardTitle: "White has fianchettoed the king bishop on g2",
    color: "black",
  },
  {
    slug: "space",
    title: "Space",
    category: "positional",
    description:
      "Space is the territory your pawns and pieces control; more space means freer piece movement.",
    definition:
      "Space is the territory your pawns and pieces control; the side with more space can shift pieces more freely.",
    paragraphs: [
      "Advanced pawns push the opponent’s pieces backward. Knights that should stand on f6 or c6 get kicked to e8 or a6. The extra room is useful only if you can still defend the pawns that created it.",
      "White’s pawns on c4, d5, and e4 take the center. Black is in a King’s Indian structure: less space, but a solid kingside and a later break with …e6 or …c6 to chip at d5.",
      "If you grab space and then stop developing, the opponent breaks and your pawns become targets. Space is an advantage when the pieces behind the pawns have squares.",
    ],
    fen: "rnbq1rk1/ppp1ppbp/3p1np1/3P4/2P1P3/2N2N2/PP3PPP/R1BQKB1R b KQ - 0 6",
    highlights: ["c4", "d5", "e4"],
    boardTitle: "White’s c4–d5–e4 chain claims a space advantage",
    color: "black",
  },
  {
    slug: "prophylaxis",
    title: "Prophylaxis",
    category: "positional",
    description:
      "Prophylaxis is a move that stops the opponent’s idea before it happens.",
    definition:
      "Prophylaxis is a move that stops the opponent’s idea before it happens, rather than chasing a threat of your own.",
    paragraphs: [
      "The move can look slow: h3, a3, Kh1, or a rook to a better file. Its value is that the opponent’s plan — a pin, a break, a piece landing on a hole — never gets started.",
      "h3 keeps a bishop off g4, so the knight on f3 cannot be pinned to the queen. Nothing is hanging, and no capture is forced. The point is that …Bg4 stops being a problem.",
      "Good prophylaxis answers a real idea, not a ghost. If the opponent had no useful pin or break, the same pawn move is only a weakness. The coach names it when the prevented plan was actually on the board.",
    ],
    fen: "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 3 6",
    highlights: ["h2", "h3", "g4", "f3"],
    boardTitle: "White can play h3 to prevent …Bg4",
    color: "white",
  },
  {
    slug: "hanging-piece",
    title: "Hanging piece",
    category: "positional",
    description:
      "A hanging piece is an unprotected unit that can be taken for free, or for more than it is worth.",
    definition:
      "A hanging piece is an unprotected unit that can be taken for free, or for more than it is worth.",
    paragraphs: [
      "“Loose pieces drop off” is the short version. If two of your pieces are unprotected, a fork will take one of them. If one piece is unprotected and attacked, it is already hanging.",
      "The knight on e4 has no pawn in front of it and no piece defending it. Both white knights attack the square. Nxe4 wins a piece.",
      "The coach uses this idea constantly: a move that leaves a piece hanging, a capture of a hanging piece, or a threat you ignored. Before you look for a brilliant tactic, check whether something is simply free.",
    ],
    fen: "r1bqkb1r/pppp1ppp/2n5/8/4n3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 5",
    highlights: ["e4", "c3", "f3"],
    boardTitle: "Black’s knight on e4 is hanging",
    color: "white",
  },
  {
    slug: "zugzwang",
    title: "Zugzwang",
    category: "endgames",
    description:
      "Zugzwang is a position where any move you play makes your situation worse, but you still have to move.",
    definition:
      "Zugzwang is a position where any move you play makes your situation worse, but you still have to move.",
    paragraphs: [
      "Chess has no pass. If every legal move loses a pawn, a key square, or the opposition, you are in zugzwang. Endgames produce it because there are so few pieces that each king step changes the evaluation.",
      "White to move must leave f1. Wherever the king goes, Black’s king and the pawn on f2 take over: the pawn promotes or the white king is forced even farther away.",
      "If it were Black’s turn, White would be safe for a moment. That is why triangulation and opposition exist — they are tools for handing the move to the opponent.",
    ],
    fen: "8/8/8/8/8/5k2/5p2/5K2 w - - 0 1",
    highlights: ["f1", "f2", "f3"],
    boardTitle: "White to move is in zugzwang",
    color: "white",
  },
  {
    slug: "opposition",
    title: "Opposition",
    category: "endgames",
    description:
      "Opposition is when the kings stand one square apart and the side that must move gives ground.",
    definition:
      "Opposition is a relationship of the two kings, one square apart on a line, where the side that does not have to move can keep the other king out.",
    paragraphs: [
      "Direct opposition is this picture: kings on the same file with one square between them. Distant opposition is the same idea with three or five squares between. Outflanking is how the king that holds the opposition walks around.",
      "White to move must step aside. Black then keeps the opposition and can shoulder White away from the key squares in front of a pawn.",
      "Most king-and-pawn endings are opposition plus zugzwang. If you take the opposition on the right rank, the pawn promotes; if you lose it, the game is a draw.",
    ],
    fen: "8/8/8/4k3/8/4K3/8/8 w - - 0 1",
    highlights: ["e3", "e4", "e5"],
    boardTitle: "The kings are in direct opposition; White to move",
    color: "white",
  },
  {
    slug: "triangulation",
    title: "Triangulation",
    category: "endgames",
    description:
      "Triangulation is a king maneuver that loses a tempo so the opponent has to give way.",
    definition:
      "Triangulation is a king maneuver that takes two moves to return to a neighboring square, losing a tempo so the opponent is the one who has to give way.",
    paragraphs: [
      "You want the same position with the other side to move. The king walks a triangle — for example d5–c4–d3–d4, or a shorter loop — and comes back a tempo down.",
      "White’s king on d5 and pawn on d4 face a black king on d7. If White could pass, Black would have to retreat and let the white king in. Triangulation is how White “passes” while still making legal moves.",
      "It only works when the opponent has no spare pawn moves. If they can push a pawn and wait, your triangle does not change whose zugzwang it is.",
    ],
    fen: "8/3k4/8/3K4/3P4/8/8/8 w - - 0 1",
    highlights: ["c4", "c5", "d3", "d4", "d5", "d7", "e4", "e5"],
    boardTitle: "White can triangulate to lose a tempo",
    color: "white",
  },
  {
    slug: "lucena-position",
    title: "Lucena position",
    category: "endgames",
    description:
      "The Lucena position is a winning rook endgame with a pawn on the seventh, won by building a bridge.",
    definition:
      "The Lucena position is a winning rook endgame with a pawn on the seventh rank, decided by building a bridge for the king.",
    paragraphs: [
      "Your king is in front of the pawn on the seventh, their king is cut off, and their rook checks from the side or the rear. You cannot just step out: the checks never stop until you block one.",
      "The bridge is a rook lift to the fourth rank. The king leaves the pawn, weathers a few checks, then hides behind its own rook so the pawn can promote.",
      "If the defender’s king is in front of the pawn instead, you are not in Lucena — you may be in Philidor, which is a draw. The difference is whose king stands on the promotion file.",
    ],
    fen: "3K4/3P1k2/8/8/8/8/7r/4R3 w - - 0 1",
    highlights: ["d7", "d8", "e1", "e4", "f7"],
    boardTitle: "A Lucena position: White builds a bridge to promote",
    color: "white",
  },
  {
    slug: "philidor-position",
    title: "Philidor position",
    category: "endgames",
    description:
      "The Philidor position is a drawing rook endgame: the defending rook stays on the sixth rank, then checks from behind.",
    definition:
      "The Philidor position is a drawing method in a rook endgame: the defending rook stays on the sixth rank until the pawn reaches it, then checks from behind.",
    paragraphs: [
      "The defending king stands in front of the pawn. The rook on the sixth rank stops the attacking king from crossing. As long as that rook stays there, the pawn cannot safely reach the sixth.",
      "When White pushes the pawn to the sixth anyway, the rook drops to the first rank and checks from the rear. The attacking king has no shelter, and the game is a draw with accurate checks.",
      "Leave the sixth rank too early and the attacking king comes forward — that path leads toward Lucena. The coach will name Philidor when the draw is still there if you keep the rook on the sixth.",
    ],
    fen: "8/8/2r5/4k3/4P3/4K3/8/4R3 b - - 0 1",
    highlights: ["c6", "e3", "e4", "e5"],
    boardTitle: "Philidor: Black’s rook holds the sixth rank",
    color: "black",
  },
  {
    slug: "wrong-bishop",
    title: "Wrong bishop",
    category: "endgames",
    description:
      "The wrong bishop does not control the promotion square of a rook pawn, so the defender can draw in the corner.",
    definition:
      "The wrong bishop is a bishop that does not control the promotion square of a rook pawn, so the defender can draw by sitting in the corner.",
    paragraphs: [
      "An a- or h-pawn promotes on a dark or light square. If your bishop cannot attack that square, you cannot eject a king that reaches the corner. Stalemate ideas appear as soon as the king is boxed in.",
      "The h-pawn promotes on h8, a dark square. The bishop on f1 is light-squared. If Black’s king gets to h8 or g8 and stays there, White cannot force it out.",
      "With any other pawn, or with a bishop that matches the promotion square, the ending is usually a win. The word “wrong” is only about that one corner.",
    ],
    fen: "6k1/8/6K1/8/7P/8/8/5B2 w - - 0 1",
    highlights: ["f1", "g6", "g8", "h4", "h8"],
    boardTitle:
      "Wrong bishop: the h-pawn promotes on a square the bishop cannot control",
    color: "white",
  },
];

const BY_SLUG = new Map(CONCEPTS.map((concept) => [concept.slug, concept]));

export function getConcept(slug: string): Concept | undefined {
  return BY_SLUG.get(slug);
}

export function conceptsInCategory(
  category: ConceptCategory,
): readonly Concept[] {
  return CONCEPTS.filter((concept) => concept.category === category);
}

for (const concept of CONCEPTS) {
  if (!isValidFenString(concept.fen)) {
    throw new Error(`Invalid FEN for /learn/${concept.slug}`);
  }
  const turn = concept.fen.split(" ")[1];
  const expected = turn === "w" ? "white" : turn === "b" ? "black" : null;
  if (expected !== concept.color) {
    throw new Error(
      `Color mismatch for /learn/${concept.slug}: FEN turn is ${turn ?? "?"}, color is ${concept.color}`,
    );
  }
  if (concept.paragraphs.length < 2 || concept.paragraphs.length > 4) {
    throw new Error(
      `Expected 2–4 paragraphs for /learn/${concept.slug}, got ${concept.paragraphs.length}`,
    );
  }
}
