import type { GameSource } from "@/app/games/data/types";

export const SOURCE_GAMES: readonly GameSource[] = [
  {
    slug: "opera-game",
    title: "Opera Game",
    white: "Paul Morphy",
    black: "Duke of Brunswick & Count Isouard",
    event: "Paris Opera",
    year: 1858,
    result: "1-0",
    hook: "A queen sacrifice mates two consulting aristocrats in seventeen moves.",
    intro:
      "Paul Morphy mates the Duke of Brunswick and Count Isouard in seventeen moves after they leave their king in the center and fall behind in development. The game is the usual classroom example of opening lines and using every piece.",
    criticalPly: 32,
    takeOverColor: "white",
    takeOverElo: 1400,
    comments: {
      "10": "White already has both bishops and the queen aiming at the uncastled king.",
      "19": "10.Nxb5 gives a piece to rip open the queenside. Black’s extra knight never gets into the game.",
      "24": "Both rooks occupy the open d-file. Black’s king is still on e8.",
      "31": "16.Qb8+ forces the last defender off d7.",
      "33": "The remaining rook mates on the back rank. Every white piece took part; the black queenside never moved.",
    },
    pgn: `[Event "Paris Opera"]
[White "Morphy, Paul"]
[Black "Duke of Brunswick & Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`,
  },
  {
    slug: "immortal-game",
    title: "Immortal Game",
    white: "Adolf Anderssen",
    black: "Lionel Kieseritzky",
    event: "London",
    year: 1851,
    result: "1-0",
    hook: "Anderssen gives both rooks and the queen, then mates with three minor pieces.",
    intro:
      "Adolf Anderssen beats Lionel Kieseritzky by sacrificing both rooks and the queen and mating with bishop and knights. The finish is the reason nineteenth-century attacking chess still gets taught from this score.",
    criticalPly: 45,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "21": "White leaves a rook hanging on g1 to keep the attack rolling.",
      "35": "18.Bd6 shuts the black king in and offers a second rook.",
      "43": "22.Qf6+ forces the knight off the mating square.",
      "45": "Bishop and two knights mate a king that never found a flight square.",
    },
    pgn: `[Event "London"]
[White "Anderssen, Adolf"]
[Black "Kieseritzky, Lionel"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5
8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8
15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6
21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`,
  },
  {
    slug: "evergreen-game",
    title: "Evergreen Game",
    white: "Adolf Anderssen",
    black: "Jean Dufresne",
    event: "Berlin",
    year: 1852,
    result: "1-0",
    hook: "Anderssen’s other immortal: a queen sacrifice and a bishop mate.",
    intro:
      "Anderssen’s other showpiece, sometimes called the Immortal Loser when the victim is named first, ends with a queen sacrifice and two bishops mating Dufresne. The combination starts from a messy Evans Gambit.",
    criticalPly: 47,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "33": "17.Nf6+ rips the g-pawn so the e-pawn can advance.",
      "39": "Black takes a hanging queen. White has already calculated past it.",
      "41": "21.Qxd7+ is the only move that works. The king is dragged to d7.",
      "47": "The bishops finish the mate. Dufresne’s extra queen never checks.",
    },
    pgn: `[Event "Berlin"]
[White "Anderssen, Adolf"]
[Black "Dufresne, Jean"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3
8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6
14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3
20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0`,
  },
  {
    slug: "game-of-the-century",
    title: "Game of the Century",
    white: "Donald Byrne",
    black: "Bobby Fischer",
    event: "Rosenwald Memorial, New York",
    year: 1956,
    result: "0-1",
    hook: "Thirteen-year-old Fischer gives a queen and mates with a windmill of checks.",
    intro:
      "Thirteen-year-old Bobby Fischer beats Donald Byrne after 17...Be6, offering the queen to keep a knight and bishop attacking the uncastled king. The rest is a series of checks that pick the position clean.",
    criticalPly: 34,
    takeOverColor: "black",
    takeOverElo: 1500,
    comments: {
      "21": "11...Na4 hits the queen and the c3-knight at once.",
      "26": "The e-pawn falls and White’s king is stuck in the center.",
      "34": "17...Be6 leaves the queen en prise. Taking it walks into a discovered check.",
      "40": "The knight windmill wins the queen back with interest.",
      "81": "The last check forces mate on c2.",
    },
    pgn: `[Event "Rosenwald Memorial"]
[White "Byrne, Donald"]
[Black "Fischer, Robert"]
[Result "0-1"]

1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6
8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4
14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+
20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1
26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4
32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+
38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1`,
  },
  {
    slug: "kasparov-topalov-1999",
    title: "Kasparov vs Topalov, 1999",
    white: "Garry Kasparov",
    black: "Veselin Topalov",
    event: "Hoogovens, Wijk aan Zee",
    year: 1999,
    result: "1-0",
    hook: "A rook sacrifice on d4 starts a twenty-move king hunt.",
    intro:
      "Kasparov’s 24.Rxd4 starts a forced chase that walks Topalov’s king from a7 to d1. The game is the modern king-hunt score people still replay when they want to see calculation held for twenty moves.",
    criticalPly: 47,
    takeOverColor: "white",
    takeOverElo: 1700,
    comments: {
      "47": "24.Rxd4 is the offer. Taking it leaves the black king on an open board.",
      "51": "25.Re7+ begins the walk. Every check takes a square away.",
      "55": "27.b4+ keeps the king on the a-file, where the queen can join.",
      "71": "36.Bf1 is quiet: the bishop waits for the rook to land on d2.",
      "87": "44.Qa7 ends it. The king never found a hole.",
    },
    pgn: `[Event "Hoogovens"]
[White "Kasparov, Garry"]
[Black "Topalov, Veselin"]
[Result "1-0"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7
8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O
14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5
20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6
26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3
32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7
38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2
44. Qa7 1-0`,
  },
  {
    slug: "deep-blue-kasparov-1997",
    title: "Deep Blue vs Kasparov, 1997",
    white: "Deep Blue",
    black: "Garry Kasparov",
    event: "IBM match, New York, game 6",
    year: 1997,
    result: "1-0",
    hook: "Game six of the rematch: a machine wins the match in nineteen moves.",
    intro:
      "Deep Blue wins the 1997 rematch in game six after Kasparov’s Caro-Kann walks into 8.Nxe6. The game is short and ugly, and it is the one people cite when they date the moment a computer beat the world champion in a match.",
    criticalPly: 16,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "10": "5.Ng5 is the line that later became a warning in the Caro-Kann.",
      "16": "8.Nxe6 is the piece offer. Black’s king will be stuck on d8.",
      "20": "10.Bg6+ keeps the king in the center.",
      "37": "Kasparov resigns a piece down with no development left.",
    },
    pgn: `[Event "IBM Deep Blue Rematch"]
[White "Deep Blue"]
[Black "Kasparov, Garry"]
[Result "1-0"]

1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Ng5 Ngf6 6. Bd3 e6 7. N1f3 h6
8. Nxe6 Qe7 9. O-O fxe6 10. Bg6+ Kd8 11. Bf4 b5 12. a4 Bb7 13. Re1 Nd5
14. Bg3 Kc8 15. axb5 cxb5 16. Qd3 Bc6 17. Bf5 exf5 18. Rxe7 Bxe7 19. c4 1-0`,
  },
  {
    slug: "karpov-kasparov-1985",
    title: "Karpov vs Kasparov, 1985",
    white: "Anatoly Karpov",
    black: "Garry Kasparov",
    event: "World Championship, Moscow, game 16",
    year: 1985,
    result: "0-1",
    hook: "Kasparov’s knight sits on d3 for eighteen moves and freezes White.",
    intro:
      "Game 16 of the 1985 title match. Kasparov plants a knight on d3 and leaves it there until Karpov finally gives the queen to remove it. The bind is the whole game.",
    criticalPly: 32,
    takeOverColor: "black",
    takeOverElo: 1700,
    comments: {
      "16": "8...d5 is the pawn offer that opens the position Kasparov wanted.",
      "32": "16...Nd3. The knight cannot be taken without wrecking White’s coordination.",
      "34": "Both white knights are back on the first rank.",
      "67": "Karpov finally takes the knight and loses the queen for it.",
      "80": "40...Re1+ and mate is a move away. Karpov resigns.",
    },
    pgn: `[Event "World Championship"]
[White "Karpov, Anatoly"]
[Black "Kasparov, Garry"]
[Result "0-1"]

1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nb5 d6 6. c4 Nf6 7. N1c3 a6
8. Na3 d5 9. cxd5 exd5 10. exd5 Nb4 11. Be2 Bc5 12. O-O O-O 13. Bf3 Bf5
14. Bg5 Re8 15. Qd2 b5 16. Rad1 Nd3 17. Nab1 h6 18. Bh4 b4 19. Na4 Bd6
20. Bg3 Rc8 21. b3 g5 22. Bxd6 Qxd6 23. g3 Nd7 24. Bg2 Qf6 25. a3 a5
26. axb4 axb4 27. Qa2 Bg6 28. d6 g4 29. Qd2 Kg7 30. f3 Qxd6 31. fxg4 Qd4+
32. Kh1 Nf6 33. Rf4 Ne4 34. Qxd3 Nf2+ 35. Rxf2 Bxd3 36. Rfd2 Qe3 37. Rxd3 Rc1
38. Nb2 Qf2 39. Nd2 Rxd1+ 40. Nxd1 Re1+ 0-1`,
  },
  {
    slug: "lasker-bauer-1889",
    title: "Lasker vs Bauer, 1889",
    white: "Emanuel Lasker",
    black: "Johann Bauer",
    event: "Amsterdam",
    year: 1889,
    result: "1-0",
    hook: "The original double bishop sacrifice on h7 and g7.",
    intro:
      "Lasker gives both bishops on h7 and g7, then picks up the queen with a rook check. Later double-bishop games quote this pattern.",
    criticalPly: 29,
    takeOverColor: "white",
    takeOverElo: 1500,
    comments: {
      "29": "15.Bxh7+ starts the pair. The king is pulled to h7.",
      "33": "17.Bxg7 is the second bishop. Declining it is worse.",
      "39": "The rook lift to h3 wins the queen for two pieces.",
      "43": "White is a queen for a rook up and the rest is technique.",
    },
    pgn: `[Event "Amsterdam"]
[White "Lasker, Emanuel"]
[Black "Bauer, Johann"]
[Result "1-0"]

1. f4 d5 2. e3 Nf6 3. b3 e6 4. Bb2 Be7 5. Bd3 b6 6. Nc3 Bb7 7. Nf3 Nbd7
8. O-O O-O 9. Ne2 c5 10. Ng3 Qc7 11. Ne5 Nxe5 12. Bxe5 Qc6 13. Qe2 a6
14. Nh5 Nxh5 15. Bxh7+ Kxh7 16. Qxh5+ Kg8 17. Bxg7 Kxg7 18. Qg4+ Kh7
19. Rf3 e5 20. Rh3+ Qh6 21. Rxh6+ Kxh6 22. Qd7 Bf6 23. Qxb7 Kg7 24. Rf1 Rab8
25. Qd7 Rfd8 26. Qg4+ Kf8 27. fxe5 Bg7 28. e6 Rb7 29. Qg6 f6 30. Rxf6+ Bxf6
31. Qxf6+ Ke8 32. Qh8+ Ke7 33. Qg7+ 1-0`,
  },
  {
    slug: "levitsky-marshall-1912",
    title: "Levitsky vs Marshall, 1912",
    white: "Stepan Levitsky",
    black: "Frank Marshall",
    event: "Breslau",
    year: 1912,
    result: "0-1",
    hook: "23...Qg3, the move that supposedly brought gold coins onto the board.",
    intro:
      "Marshall’s 23...Qg3 puts the queen on a square attacked three times. Every capture loses, and Levitsky resigned. The gold-coin story is later folklore; the move is real.",
    criticalPly: 46,
    takeOverColor: "black",
    takeOverElo: 1500,
    comments: {
      "38": "19...Nd4 opens the long diagonal toward White’s king.",
      "44": "The h-file rook has already taken on h3.",
      "46": "23...Qg3. If 24.hxg3 Ne2 is mate; if 24.fxg3 Ne2+ wins the queen; if 24.Qxg3 Ne2+ 25.Kh1 Nxg3+ and the rook falls.",
    },
    pgn: `[Event "Breslau"]
[White "Levitsky, Stepan"]
[Black "Marshall, Frank"]
[Result "0-1"]

1. d4 e6 2. e4 d5 3. Nc3 c5 4. Nf3 Nc6 5. exd5 exd5 6. Be2 Nf6 7. O-O Be7
8. Bg5 O-O 9. dxc5 Be6 10. Nd4 Bxc5 11. Nxe6 fxe6 12. Bg4 Qd6 13. Bh3 Rae8
14. Qd2 Bb4 15. Bxf6 Rxf6 16. Rad1 Qc5 17. Qe2 Bxc3 18. bxc3 Qxc3 19. Rxd5 Nd4
20. Qh5 Ref8 21. Re5 Rh6 22. Qg5 Rxh3 23. Rc5 Qg3 0-1`,
  },
  {
    slug: "fischer-spassky-1972",
    title: "Fischer vs Spassky, 1972",
    white: "Bobby Fischer",
    black: "Boris Spassky",
    event: "World Championship, Reykjavik, game 6",
    year: 1972,
    result: "1-0",
    hook: "Fischer plays 1.c4 and wins a model Queen’s Gambit. Spassky applauded.",
    intro:
      "Game 6 of the 1972 match. Fischer, who almost always opened 1.e4, plays 1.c4 and beats Spassky’s Tartakower in a clean squeeze. After 41.Qf4 Spassky resigned and joined the applause.",
    criticalPly: 40,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "1": "1.c4. Fischer had almost never opened this way in a serious game.",
      "39": "20.e4 is the break. Black’s hanging pawns stop moving.",
      "51": "26.f5 opens a file toward the king.",
      "61": "31.e6 ties Black’s pieces to the blockade.",
      "75": "38.Rxf6 rips the last cover. Spassky resigns a few moves later.",
    },
    pgn: `[Event "World Championship"]
[White "Fischer, Robert"]
[Black "Spassky, Boris"]
[Result "1-0"]

1. c4 e6 2. Nf3 d5 3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6 7. Bh4 b6
8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6 12. Qa4 c5 13. Qa3 Rc8
14. Bb5 a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf8 19. Nxe6 fxe6
20. e4 d4 21. f4 Qe7 22. e5 Rb8 23. Bc4 Kh8 24. Qh3 Nf8 25. b3 a5 26. f5 exf5
27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7 31. e6 Rbc7 32. Qe5 Qe8
33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8 36. Bd3 Qe8 37. Qe4 Nf6 38. Rxf6 gxf6
39. Rxf6 Kg8 40. Bc4 Kh8 41. Qf4 1-0`,
  },
  {
    slug: "botvinnik-capablanca-1938",
    title: "Botvinnik vs Capablanca, 1938",
    white: "Mikhail Botvinnik",
    black: "José Raúl Capablanca",
    event: "AVRO, Rotterdam",
    year: 1938,
    result: "1-0",
    hook: "30.Ba3 deflects the queen; a knight sac and a passed pawn finish it.",
    intro:
      "Botvinnik’s 30.Ba3 pulls Capablanca’s queen off the e-file so 31.Nh5+ and the e-pawn can run. The combination is calculated past a long check sequence.",
    criticalPly: 59,
    takeOverColor: "white",
    takeOverElo: 1700,
    comments: {
      "37": "19.e4 starts the central pawn roll that the whole game is about.",
      "59": "30.Ba3. The queen must leave e7 or the pawn queens.",
      "61": "31.Nh5+ must be taken. The knight on f6 is pinned.",
      "67": "34.e7 and the pawn is one square from a queen. The rest is checks.",
    },
    pgn: `[Event "AVRO"]
[White "Botvinnik, Mikhail"]
[Black "Capablanca, Jose Raul"]
[Result "1-0"]

1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 d5 5. a3 Bxc3+ 6. bxc3 c5 7. cxd5 exd5
8. Bd3 O-O 9. Ne2 b6 10. O-O Ba6 11. Bxa6 Nxa6 12. Bb2 Qd7 13. a4 Rfe8
14. Qd3 c4 15. Qc2 Nb8 16. Rae1 Nc6 17. Ng3 Na5 18. f3 Nb3 19. e4 Qxa4
20. e5 Nd7 21. Qf2 g6 22. f4 f5 23. exf6 Nxf6 24. f5 Rxe1 25. Rxe1 Re8
26. Re6 Rxe6 27. fxe6 Kg7 28. Qf4 Qe8 29. Qe5 Qe7 30. Ba3 Qxa3 31. Nh5+ gxh5
32. Qg5+ Kf8 33. Qxf6+ Kg8 34. e7 Qc1+ 35. Kf2 Qc2+ 36. Kg3 Qd3+ 37. Kh4 Qe4+
38. Kxh5 Qe2+ 39. Kh4 Qe4+ 40. g4 Qe1+ 41. Kh5 1-0`,
  },
  {
    slug: "steinitz-von-bardeleben-1895",
    title: "Steinitz vs von Bardeleben, 1895",
    white: "Wilhelm Steinitz",
    black: "Curt von Bardeleben",
    event: "Hastings",
    year: 1895,
    result: "1-0",
    hook: "A rook stays en prise for five moves, then a forced mate in ten.",
    intro:
      "Steinitz’s rook hops along the seventh rank, always hanging, until von Bardeleben leaves the room rather than play out the mate. The finish after 25.Rxh7+ is a ten-move forced line.",
    criticalPly: 49,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "35": "18.Nd4 opens the e-file against a king that just stepped to f7.",
      "43": "22.Rxe7+ starts the hanging-rook sequence.",
      "49": "25.Rxh7+. Von Bardeleben did not wait for 26.Rg7+ and the queen checks that follow.",
    },
    pgn: `[Event "Hastings"]
[White "Steinitz, Wilhelm"]
[Black "von Bardeleben, Curt"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 d5
8. exd5 Nxd5 9. O-O Be6 10. Bg5 Be7 11. Bxd5 Bxd5 12. Nxd5 Qxd5 13. Bxe7 Nxe7
14. Re1 f6 15. Qe2 Qd7 16. Rac1 c6 17. d5 cxd5 18. Nd4 Kf7 19. Ne6 Rhc8
20. Qg4 g6 21. Ng5+ Ke8 22. Rxe7+ Kf8 23. Rf7+ Kg8 24. Rg7+ Kh8 25. Rxh7+ 1-0`,
  },
  {
    slug: "rotlewi-rubinstein-1907",
    title: "Rotlewi vs Rubinstein, 1907",
    white: "Georg Rotlewi",
    black: "Akiba Rubinstein",
    event: "Lodz",
    year: 1907,
    result: "0-1",
    hook: "Rubinstein’s 22...Rxc3 starts a four-move combination still in every tactics book.",
    intro:
      "Rubinstein’s finish against Rotlewi is the model for sacrificing on c3 and then using both bishops against an exposed king. 22...Rxc3 through 25...Rh3 is the sequence.",
    criticalPly: 44,
    takeOverColor: "black",
    takeOverElo: 1600,
    comments: {
      "39": "20...Ng4 and 21...Qh4 put every black piece on the white king.",
      "43": "22...Rxc3. Taking the rook loses to ...Rd2 and mate on the long diagonal.",
      "47": "24...Bxe4+ and 25...Rh3 leave White no check and no defense of h2.",
    },
    pgn: `[Event "Lodz"]
[White "Rotlewi, Georg"]
[Black "Rubinstein, Akiba"]
[Result "0-1"]

1. d4 d5 2. Nf3 e6 3. e3 c5 4. c4 Nc6 5. Nc3 Nf6 6. dxc5 Bxc5 7. a3 a6
8. b4 Bd6 9. Bb2 O-O 10. Qd2 Qe7 11. Bd3 dxc4 12. Bxc4 b5 13. Bd3 Rd8
14. Qe2 Bb7 15. O-O Ne5 16. Nxe5 Bxe5 17. f4 Bc7 18. e4 Rac8 19. e5 Bb6+
20. Kh1 Ng4 21. Be4 Qh4 22. g3 Rxc3 23. gxh4 Rd2 24. Qxd2 Bxe4+ 25. Qg2 Rh3 0-1`,
  },
  {
    slug: "reti-bogoljubov-1924",
    title: "Réti vs Bogoljubov, 1924",
    white: "Richard Réti",
    black: "Efim Bogoljubov",
    event: "New York",
    year: 1924,
    result: "1-0",
    hook: "25.Be8, a quiet last move that stops every black piece at once.",
    intro:
      "Réti’s New York 1924 win ends with 25.Be8, a move that pins the back rank and leaves Bogoljubov with no useful reply. The game is the usual example of hypermodern pressure turning into a direct attack.",
    criticalPly: 49,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "29": "15.e4 opens the center once Black’s pawns have been provoked.",
      "43": "22.Qxf5 wins a piece because the d4-rook is loose.",
      "49": "25.Be8. The bishop shuts the back rank. Black cannot stop mate and save the rook.",
    },
    pgn: `[Event "New York"]
[White "Reti, Richard"]
[Black "Bogoljubov, Efim"]
[Result "1-0"]

1. Nf3 d5 2. c4 e6 3. g3 Nf6 4. Bg2 Bd6 5. O-O O-O 6. b3 Re8 7. Bb2 Nbd7
8. d4 c6 9. Nbd2 Ne4 10. Nxe4 dxe4 11. Ne5 f5 12. f3 exf3 13. Bxf3 Qc7
14. Nxd7 Bxd7 15. e4 e5 16. c5 Bf8 17. Qc2 exd4 18. exf5 Rad8 19. Bh5 Re5
20. Bxd4 Rxf5 21. Rxf5 Bxf5 22. Qxf5 Rxd4 23. Rf1 Rd8 24. Bf7+ Kh8 25. Be8 1-0`,
  },
  {
    slug: "samisch-nimzowitsch-1923",
    title: "Sämisch vs Nimzowitsch, 1923",
    white: "Friedrich Sämisch",
    black: "Aron Nimzowitsch",
    event: "Copenhagen",
    year: 1923,
    result: "0-1",
    hook: "The Immortal Zugzwang: White has pieces and no move that does not lose.",
    intro:
      "Nimzowitsch’s win over Sämisch is the textbook zugzwang. After 25...h6 White can move a piece only by dropping material or allowing mate. Sämisch resigned with a full board.",
    criticalPly: 50,
    takeOverColor: "black",
    takeOverElo: 1500,
    comments: {
      "41": "21...Rxf2 is the exchange offer that plants a rook on the second rank.",
      "47": "24...R8f5 and the bishop on d3 take the last squares from White’s queen.",
      "50": "25...h6. Almost every white move loses a piece or allows ...R5f3. That is the point of the game.",
    },
    pgn: `[Event "Copenhagen"]
[White "Saemisch, Friedrich"]
[Black "Nimzowitsch, Aron"]
[Result "0-1"]

1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Bb7 5. Bg2 Be7 6. Nc3 O-O 7. O-O d5
8. Ne5 c6 9. cxd5 cxd5 10. Bf4 a6 11. Rc1 b5 12. Qb3 Nc6 13. Nxc6 Bxc6
14. h3 Qd7 15. Kh2 Nh5 16. Bd2 f5 17. Qd1 b4 18. Nb1 Bb5 19. Rg1 Bd6
20. e4 fxe4 21. Qxh5 Rxf2 22. Qg5 Raf8 23. Kh1 R8f5 24. Qe3 Bd3 25. Rce1 h6 0-1`,
  },
  {
    slug: "torre-lasker-1925",
    title: "Torre vs Lasker, 1925",
    white: "Carlos Torre",
    black: "Emanuel Lasker",
    event: "Moscow",
    year: 1925,
    result: "1-0",
    hook: "The windmill: a rook checks along the seventh until Lasker’s queen falls.",
    intro:
      "Carlos Torre’s 25.Bf6 starts the windmill. The rook checks on g7, f7, b7, and g7 again, and Lasker’s queen on h5 is collected at the end of the sequence.",
    criticalPly: 50,
    takeOverColor: "white",
    takeOverElo: 1500,
    comments: {
      "42": "21.b4 shuts the queen out of a5 before the combination.",
      "50": "25.Bf6. The bishop cannot be taken, and the queen on h5 is now loose.",
      "52": "The first check of the windmill. Each discovered check picks something up.",
      "64": "32.Rxh5 is the payoff. White is a piece up.",
    },
    pgn: `[Event "Moscow"]
[White "Torre, Carlos"]
[Black "Lasker, Emanuel"]
[Result "1-0"]

1. d4 Nf6 2. Nf3 e6 3. Bg5 c5 4. e3 cxd4 5. exd4 Be7 6. Nbd2 d6 7. c3 Nbd7
8. Bd3 b6 9. Nc4 Bb7 10. Qe2 Qc7 11. O-O O-O 12. Rfe1 Rfe8 13. Rad1 Nf8
14. Bc1 Nd5 15. Ng5 b5 16. Na3 b4 17. cxb4 Nxb4 18. Qh5 Bxg5 19. Bxg5 Nxd3
20. Rxd3 Qa5 21. b4 Qf5 22. Rg3 h6 23. Nc4 Qd5 24. Ne3 Qb5 25. Bf6 Qxh5
26. Rxg7+ Kh8 27. Rxf7+ Kg8 28. Rg7+ Kh8 29. Rxb7+ Kg8 30. Rg7+ Kh8
31. Rg5+ Kh7 32. Rxh5 Kg6 33. Rh3 Kxf6 34. Rxh6+ Kg5 35. Rh3 Rec8 36. Rg3+ Kf6
37. Rf3+ Kg6 38. a3 a5 39. bxa5 Rxa5 40. Nc4 Rd5 41. Rf4 Nd7 42. Rxe6+ Kg5
43. g3 1-0`,
  },
  {
    slug: "short-timman-1991",
    title: "Short vs Timman, 1991",
    white: "Nigel Short",
    black: "Jan Timman",
    event: "Tilburg",
    year: 1991,
    result: "1-0",
    hook: "Short walks his king to g5 in a middlegame and mates with it.",
    intro:
      "Short’s king walks from g1 to g5 while queens are still on the board. 34.Kg5 is the move that made the game famous: the king is a mating piece, not a liability.",
    criticalPly: 67,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "57": "29.Qf6+ fixes the black king and frees White’s own king to walk.",
      "63": "32.Kg3. The king is going to g5 on purpose.",
      "67": "34.Kg5. Mate on h6 is next unless Black can check, and he cannot.",
    },
    pgn: `[Event "Tilburg"]
[White "Short, Nigel"]
[Black "Timman, Jan"]
[Result "1-0"]

1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3 g6 5. Bc4 Nb6 6. Bb3 Bg7 7. Qe2 Nc6
8. O-O O-O 9. h3 a5 10. a4 dxe5 11. dxe5 Nd4 12. Nxd4 Qxd4 13. Re1 e6
14. Nd2 Nd5 15. Nf3 Qc5 16. Qe4 Qb4 17. Bc4 Nb6 18. b3 Nxc4 19. bxc4 Re8
20. Rd1 Qc5 21. Qh4 b6 22. Be3 Qc6 23. Bh6 Bh8 24. Rd8 Bb7 25. Rad1 Bg7
26. R8d7 Rf8 27. Bxg7 Kxg7 28. R1d4 Rae8 29. Qf6+ Kg8 30. h4 h5 31. Kh2 Rc8
32. Kg3 Rce8 33. Kf4 Bc8 34. Kg5 1-0`,
  },
  {
    slug: "tal-hecht-1962",
    title: "Tal vs Hecht, 1962",
    white: "Mikhail Tal",
    black: "Hans-Joachim Hecht",
    event: "Varna Olympiad",
    year: 1962,
    result: "1-0",
    hook: "Tal leaves a queen and a bishop hanging. Hecht declines; the ending still goes to Tal.",
    intro:
      "Tal’s 21.Bf5 offers the queen and hangs a bishop. Hecht takes the bishop instead of the queen, and the resulting ending — two rooks against a rook and knight — is what Tal converts.",
    criticalPly: 41,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "35": "18.e5 opens the diagonal the bishop will use.",
      "37": "19.exf6. The queen on a4 is hanging. Black takes it.",
      "41": "21.Bf5. The queen and the bishop are both en prise. Taking the queen walks into Nd6+.",
      "43": "Hecht takes the bishop. Tal keeps enough pieces to win the ending.",
    },
    pgn: `[Event "Varna Olympiad"]
[White "Tal, Mikhail"]
[Black "Hecht, Hans-Joachim"]
[Result "1-0"]

1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. Nc3 Bb4 5. Bg5 Bb7 6. e3 h6 7. Bh4 Bxc3+
8. bxc3 d6 9. Nd2 e5 10. f3 Qe7 11. e4 Nbd7 12. Bd3 Nf8 13. c5 dxc5 14. dxe5 Qxe5
15. Qa4+ c6 16. O-O Ng6 17. Nc4 Qe6 18. e5 b5 19. exf6 bxa4 20. fxg7 Rg8
21. Bf5 Nxh4 22. Bxe6 Ba6 23. Nd6+ Ke7 24. Bc4 Rxg7 25. g3 Kxd6 26. Bxa6 Nf5
27. Rab1 f6 28. Rfd1+ Ke7 29. Re1+ Kd6 30. Kf2 c4 31. g4 Ne7 32. Rb7 Rag8
33. Bxc4 Nd5 34. Bxd5 cxd5 35. Rb4 Rc8 36. Rxa4 Rxc3 37. Ra6+ Kc5 38. Rxf6 h5
39. h3 hxg4 40. hxg4 Rh7 41. g5 Rh5 42. Rf5 Rc2+ 43. Kg3 Kc4 44. Ree5 d4
45. g6 Rh1 46. Rc5+ Kd3 47. Rxc2 Kxc2 48. Kf4 Rg1 49. Rg5 1-0`,
  },
  {
    slug: "paulsen-morphy-1857",
    title: "Paulsen vs Morphy, 1857",
    white: "Louis Paulsen",
    black: "Paul Morphy",
    event: "First American Chess Congress, New York",
    year: 1857,
    result: "0-1",
    hook: "17...Qxf3, Morphy’s queen sacrifice on an empty-looking board.",
    intro:
      "Morphy’s 17...Qxf3 against Paulsen is the other queen sacrifice people learn after the Opera Game. The follow-up 18...Rg6+ and the bishop pair decide it.",
    criticalPly: 34,
    takeOverColor: "black",
    takeOverElo: 1500,
    comments: {
      "24": "12...Qd3 parks the queen in White’s camp before the sacrifice.",
      "34": "17...Qxf3. The queen is taken; the g-file and the bishops do the rest.",
      "38": "19...Bh3 threatens mate on g2 and stops the king from running.",
      "52": "The second rook lands on e2. Paulsen is a queen up and lost.",
    },
    pgn: `[Event "American Chess Congress"]
[White "Paulsen, Louis"]
[Black "Morphy, Paul"]
[Result "0-1"]

1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 4. Bb5 Bc5 5. O-O O-O 6. Nxe5 Re8 7. Nxc6 dxc6
8. Bc4 b5 9. Be2 Nxe4 10. Nxe4 Rxe4 11. Bf3 Re6 12. c3 Qd3 13. b4 Bb6
14. a4 bxa4 15. Qxa4 Bd7 16. Ra2 Rae8 17. Qa6 Qxf3 18. gxf3 Rg6+ 19. Kh1 Bh3
20. Rd1 Bg2+ 21. Kg1 Bxf3+ 22. Kf1 Bg2+ 23. Kg1 Bh3+ 24. Kh1 Bxf2 25. Qf1 Bxf1
26. Rxf1 Re2 27. Ra1 Rh6 28. d4 Be3 0-1`,
  },
  {
    slug: "capablanca-marshall-1918",
    title: "Capablanca vs Marshall, 1918",
    white: "José Raúl Capablanca",
    black: "Frank Marshall",
    event: "New York",
    year: 1918,
    result: "1-0",
    hook: "Marshall’s prepared 8...d5 novelty, refuted over the board.",
    intro:
      "Marshall sprung 8...d5, a prepared pawn sacrifice, on Capablanca. Capablanca found the defense at the board and won. The line is still called the Marshall Attack.",
    criticalPly: 17,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "16": "8...d5 is the prepared break. White can take on d5 and e5.",
      "26": "13...Ng4 and 14...Qh4 are the attack Marshall had analyzed at home.",
      "31": "16.Re2 is the over-the-board find that holds the king.",
      "71": "36.Bxf7+ ends the counterplay. Marshall’s extra exchange is not enough.",
    },
    pgn: `[Event "New York"]
[White "Capablanca, Jose Raul"]
[Black "Marshall, Frank"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O
8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 Nf6 12. Re1 Bd6 13. h3 Ng4
14. Qf3 Qh4 15. d4 Nxf2 16. Re2 Bg4 17. hxg4 Bh2+ 18. Kf1 Bg3 19. Rxf2 Qh1+
20. Ke2 Bxf2 21. Bd2 Bh4 22. Qh3 Rae8+ 23. Kd3 Qf1+ 24. Kc2 Bf2 25. Qf3 Qg1
26. Bd5 c5 27. dxc5 Bxc5 28. b4 Bd6 29. a4 a5 30. axb5 axb4 31. Ra6 bxc3
32. Nxc3 Bb4 33. b6 Bxc3 34. Bxc3 h6 35. b7 Re3 36. Bxf7+ 1-0`,
  },
  {
    slug: "alekhine-feldt-1916",
    title: "Alekhine vs Feldt, 1916",
    white: "Alexander Alekhine",
    black: "M. Feldt",
    event: "Tarnopol (blindfold)",
    year: 1916,
    result: "1-0",
    hook: "A blindfold miniature: 15.Nf7 and 16.Qxe6+ mate the king on g6.",
    intro:
      "Alekhine played this French Defense blindfold in a hospital exhibition. 15.Nf7 and 16.Qxe6+ force the king to g6, where 18.Nh4 is mate.",
    criticalPly: 30,
    takeOverColor: "white",
    takeOverElo: 1500,
    comments: {
      "29": "15.Nf7 leaves the queen and the e6-pawn both hanging.",
      "31": "16.Qxe6+ pulls the king onto the color the knights want.",
      "35": "18.Nh4# is mate with the king on g6 and no flight square.",
    },
    pgn: `[Event "Tarnopol"]
[White "Alekhine, Alexander"]
[Black "Feldt, M."]
[Result "1-0"]

1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. exd5 Nxd5 5. Ne4 f5 6. Ng5 Be7 7. N5f3 c6
8. Ne5 O-O 9. Ngf3 b6 10. Bd3 Bb7 11. O-O Re8 12. c4 Nf6 13. Bf4 Nbd7
14. Qe2 c5 15. Nf7 Kxf7 16. Qxe6+ Kg6 17. g4 Be4 18. Nh4# 1-0`,
  },
  {
    slug: "edward-lasker-thomas-1912",
    title: "Edward Lasker vs Thomas, 1912",
    white: "Edward Lasker",
    black: "George Thomas",
    event: "London",
    year: 1912,
    result: "1-0",
    hook: "A king hunt that ends with 18.O-O-O mate.",
    intro:
      "Edward Lasker (not Emanuel) sacrifices the queen on h7 and walks Thomas’s king from h7 to g1. Castling queenside is the mating move.",
    criticalPly: 35,
    takeOverColor: "white",
    takeOverElo: 1400,
    comments: {
      "21": "11.Qxh7+ is the start. The king has to take.",
      "27": "14.h4+ and 15.g3+ drive the king into White’s camp.",
      "35": "18.O-O-O# mates by discovered check. The king has walked to g1.",
    },
    pgn: `[Event "London"]
[White "Lasker, Edward"]
[Black "Thomas, George"]
[Result "1-0"]

1. d4 e6 2. Nf3 f5 3. Nc3 Nf6 4. Bg5 Be7 5. Bxf6 Bxf6 6. e4 fxe4 7. Nxe4 b6
8. Ne5 O-O 9. Bd3 Bb7 10. Qh5 Qe7 11. Qxh7+ Kxh7 12. Nxf6+ Kh6 13. Neg4+ Kg5
14. h4+ Kf4 15. g3+ Kf3 16. Be2+ Kg2 17. Rh2+ Kg1 18. O-O-O# 1-0`,
  },
  {
    slug: "spassky-bronstein-1960",
    title: "Spassky vs Bronstein, 1960",
    white: "Boris Spassky",
    black: "David Bronstein",
    event: "USSR Championship, Leningrad",
    year: 1960,
    result: "1-0",
    hook: "A King’s Gambit that later showed up in a James Bond film.",
    intro:
      "Spassky’s King’s Gambit against Bronstein ends with a knight on e5 and a queen on e4 after Black’s king is stripped. The game was later used on screen in From Russia with Love.",
    criticalPly: 32,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "20": "10...Ne3 is the piece offer that tries to wreck White’s coordination.",
      "31": "16.Nxf7 takes on f7 after the e2-pawn has promoted and been recaptured.",
      "45": "23.Qe4. Black is a rook up and the king cannot be defended.",
    },
    pgn: `[Event "USSR Championship"]
[White "Spassky, Boris"]
[Black "Bronstein, David"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Nf3 d5 4. exd5 Bd6 5. Nc3 Ne7 6. d4 O-O 7. Bd3 Nd7
8. O-O h6 9. Ne4 Nxd5 10. c4 Ne3 11. Bxe3 fxe3 12. c5 Be7 13. Bc2 Re8
14. Qd3 e2 15. Nd6 Nf8 16. Nxf7 exf1=Q+ 17. Rxf1 Bf5 18. Qxf5 Qd7 19. Qf4 Bf6
20. N3e5 Qe7 21. Bb3 Bxe5 22. Nxe5+ Kh7 23. Qe4 1-0`,
  },
  {
    slug: "zukertort-blackburne-1883",
    title: "Zukertort vs Blackburne, 1883",
    white: "Johannes Zukertort",
    black: "Joseph Blackburne",
    event: "London",
    year: 1883,
    result: "1-0",
    hook: "28.Qb4, a quiet queen move that starts a forced win.",
    intro:
      "Zukertort’s 28.Qb4 looks like a retreat. It threatens mate and a rook, and the combination that follows — 29.Rf8+ and 31.Bxe5+ — wins Blackburne’s queen.",
    criticalPly: 55,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "49": "25...Rc2 looks winning. White has already seen past it.",
      "55": "28.Qb4. The queen leaves d2 and the whole attack works.",
      "57": "29.Rf8+ forces the king onto the long diagonal.",
      "65": "33.Qxe7. White is a queen up.",
    },
    pgn: `[Event "London"]
[White "Zukertort, Johannes"]
[Black "Blackburne, Joseph"]
[Result "1-0"]

1. c4 e6 2. e3 Nf6 3. Nf3 b6 4. Be2 Bb7 5. O-O d5 6. d4 Bd6 7. Nc3 O-O
8. b3 Nbd7 9. Bb2 Qe7 10. Nb5 Ne4 11. Nxd6 cxd6 12. Nd2 Ndf6 13. f3 Nxd2
14. Qxd2 dxc4 15. Bxc4 d5 16. Bd3 Rfc8 17. Rae1 Rc7 18. e4 Rac8 19. e5 Ne8
20. f4 g6 21. Re3 f5 22. exf6 Nxf6 23. f5 Ne4 24. Bxe4 dxe4 25. fxg6 Rc2
26. gxh7+ Kh8 27. d5+ e5 28. Qb4 R8c5 29. Rf8+ Kxh7 30. Qxe4+ Kg7 31. Bxe5+ Kxf8
32. Bg7+ Kg8 33. Qxe7 1-0`,
  },
  {
    slug: "byrne-fischer-1963",
    title: "Robert Byrne vs Fischer, 1963",
    white: "Robert Byrne",
    black: "Bobby Fischer",
    event: "US Championship, New York",
    year: 1963,
    result: "0-1",
    hook: "Fischer’s 15...Nxf2 leads to a king walk and a resignation in a full board.",
    intro:
      "The other Byrne–Fischer classic. After 15...Nxf2 Fischer’s minor pieces chase the white king, and Byrne resigns in a position that still looks crowded. It was part of Fischer’s 11–0 US Championship.",
    criticalPly: 30,
    takeOverColor: "black",
    takeOverElo: 1600,
    comments: {
      "28": "14...Nd3 plants the knight that will take on f2.",
      "30": "15...Nxf2. The king is pulled to f2 and never gets safe.",
      "40": "20...Bb7+ forces the king to f1, where the queen check ends it.",
    },
    pgn: `[Event "US Championship"]
[White "Byrne, Robert"]
[Black "Fischer, Robert"]
[Result "0-1"]

1. d4 Nf6 2. c4 g6 3. g3 c6 4. Bg2 d5 5. cxd5 cxd5 6. Nc3 Bg7 7. e3 O-O
8. Nge2 Nc6 9. O-O b6 10. b3 Ba6 11. Ba3 Re8 12. Qd2 e5 13. dxe5 Nxe5
14. Rfd1 Nd3 15. Qc2 Nxf2 16. Kxf2 Ng4+ 17. Kg1 Nxe3 18. Qd2 Nxg2 19. Kxg2 d4
20. Nxd4 Bb7+ 21. Kf1 Qd7 0-1`,
  },
  {
    slug: "mcdonnell-labourdonnais-1834",
    title: "McDonnell vs La Bourdonnais, 1834",
    white: "Alexander McDonnell",
    black: "Louis-Charles de la Bourdonnais",
    event: "London, match game 16",
    year: 1834,
    result: "0-1",
    hook: "Three black pawns on the second rank beat a queen.",
    intro:
      "La Bourdonnais’s three connected passed pawns reach the second rank and outweigh McDonnell’s queen. The final position — pawns on d2, e2, and f2 — is the picture most histories print.",
    criticalPly: 73,
    takeOverColor: "black",
    takeOverElo: 1500,
    comments: {
      "47": "24...exf3 starts the pawn roll that the game is remembered for.",
      "67": "34...d2 and the pawns are one file from promotion.",
      "73": "37...e2. Three pawns on the second rank; the queen cannot stop them all.",
    },
    pgn: `[Event "London"]
[White "McDonnell, Alexander"]
[Black "de la Bourdonnais, Louis-Charles"]
[Result "0-1"]

1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 e5 5. Nxc6 bxc6 6. Bc4 Nf6 7. Bg5 Be7
8. Qe2 d5 9. Bxf6 Bxf6 10. Bb3 O-O 11. O-O a5 12. exd5 cxd5 13. Rd1 d4
14. c4 Qb6 15. Bc2 Bb7 16. Nd2 Rae8 17. Ne4 Bd8 18. c5 Qc6 19. f3 Be7
20. Rac1 f5 21. Qc4+ Kh8 22. Ba4 Qh6 23. Bxe8 fxe4 24. c6 exf3 25. Rc2 Qe3+
26. Kh1 Bc8 27. Bd7 f2 28. Rf1 d3 29. Rc3 Bxd7 30. cxd7 e4 31. Qc8 Bd8
32. Qc4 Qe1 33. Rc1 d2 34. Qc5 Rg8 35. Rd1 e3 36. Qc3 Qxd1 37. Rxd1 e2 0-1`,
  },
  {
    slug: "kasparov-karpov-1986",
    title: "Kasparov vs Karpov, 1986",
    white: "Garry Kasparov",
    black: "Anatoly Karpov",
    event: "World Championship, Leningrad, game 16",
    year: 1986,
    result: "1-0",
    hook: "Karpov’s knight reaches d3; Kasparov still crashes through on the kingside.",
    intro:
      "Game 16 of the 1986 rematch in Leningrad. Karpov plants a knight on d3, the same outpost as Kasparov’s 1985 win with colors reversed. Kasparov ignores it long enough to take on h6 and win with a rook lift.",
    criticalPly: 50,
    takeOverColor: "white",
    takeOverElo: 1700,
    comments: {
      "28": "14...Nb4 heads for the hole on d3.",
      "50": "25...Nbd3. The knight sits on the same square as in Moscow the year before.",
      "54": "28.Bxh6 takes the pawn in front of the king. The knight on d3 does not defend h6.",
      "81": "41.Nxf7. The d-pawn is one square from a queen.",
    },
    pgn: `[Event "World Championship"]
[White "Kasparov, Garry"]
[Black "Karpov, Anatoly"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6
8. c3 O-O 9. h3 Bb7 10. d4 Re8 11. Nbd2 Bf8 12. a4 h6 13. Bc2 exd4 14. cxd4 Nb4
15. Bb1 c5 16. d5 Nd7 17. Ra3 c4 18. Nd4 Qf6 19. N2f3 Nc5 20. axb5 axb5
21. Nxb5 Rxa3 22. Nxa3 Ba6 23. Re3 Rb8 24. e5 dxe5 25. Nxe5 Nbd3 26. Ng4 Qb6
27. Rg3 g6 28. Bxh6 Qxb2 29. Qf3 Nd7 30. Bxf8 Kxf8 31. Kh2 Rb3 32. Bxd3 cxd3
33. Qf4 Qxa3 34. Nh6 Qe7 35. Rxg6 Qe5 36. Rg8+ Ke7 37. d6+ Ke6 38. Re8+ Kd5
39. Rxe5+ Nxe5 40. d7 Rb8 41. Nxf7 1-0`,
  },
  {
    slug: "carlsen-anand-2013",
    title: "Carlsen vs Anand, 2013",
    white: "Magnus Carlsen",
    black: "Viswanathan Anand",
    event: "World Championship, Chennai, game 5",
    year: 2013,
    result: "1-0",
    hook: "Carlsen’s first title-match win: a rook ending Anand could not hold.",
    intro:
      "Game 5 in Chennai gave Carlsen the lead in the 2013 match. Queens came off early. The rook ending with an extra a-pawn is the kind of grind he is known for.",
    criticalPly: 115,
    takeOverColor: "white",
    takeOverElo: 1700,
    comments: {
      "29": "15.Qxd8+ is the trade Carlsen wanted. The ending is what he plays for.",
      "39": "20.cxb6 and 21.b7 make a passed pawn on the seventh.",
      "114": "58.h4. A second passed pawn starts. Anand resigns.",
    },
    pgn: `[Event "World Championship"]
[White "Carlsen, Magnus"]
[Black "Anand, Viswanathan"]
[Result "1-0"]

1. c4 e6 2. d4 d5 3. Nc3 c6 4. e4 dxe4 5. Nxe4 Bb4+ 6. Nc3 c5 7. a3 Ba5
8. Nf3 Nf6 9. Be3 Nc6 10. Qd3 cxd4 11. Nxd4 Ng4 12. O-O-O Nxe3 13. fxe3 Bc7
14. Nxc6 bxc6 15. Qxd8+ Bxd8 16. Be2 Ke7 17. Bf3 Bd7 18. Ne4 Bb6 19. c5 f5
20. cxb6 fxe4 21. b7 Rab8 22. Bxe4 Rxb7 23. Rhf1 Rb5 24. Rf4 g5 25. Rf3 h5
26. Rdf1 Be8 27. Bc2 Rc5 28. Rf6 h4 29. e4 a5 30. Kd2 Rb5 31. b3 Bh5
32. Kc3 Rc5+ 33. Kb2 Rd8 34. R1f2 Rd4 35. Rh6 Bd1 36. Bb1 Rb5 37. Kc3 c5
38. Rb2 e5 39. Rg6 a4 40. Rxg5 Rxb3+ 41. Rxb3 Bxb3 42. Rxe5+ Kd6 43. Rh5 Rd1
44. e5+ Kd5 45. Bh7 Rc1+ 46. Kb2 Rg1 47. Bg8+ Kc6 48. Rh6+ Kd7 49. Bxb3 axb3
50. Kxb3 Rxg2 51. Rxh4 Ke6 52. a4 Kxe5 53. a5 Kd6 54. Rh7 Kd5 55. a6 c4+
56. Kc3 Ra2 57. a7 Kc5 58. h4 1-0`,
  },
  {
    slug: "nezhmetdinov-chernikov-1962",
    title: "Nezhmetdinov vs Chernikov, 1962",
    white: "Rashid Nezhmetdinov",
    black: "Oleg Chernikov",
    event: "Rostov",
    year: 1962,
    result: "1-0",
    hook: "12.Qxf6, a queen for two pieces that never lets Black untangle.",
    intro:
      "Nezhmetdinov’s 12.Qxf6 gives the queen for two minor pieces. Chernikov’s extra queen sits while the knights and bishops take the dark squares. The finish is 29.Rh8+.",
    criticalPly: 23,
    takeOverColor: "white",
    takeOverElo: 1600,
    comments: {
      "21": "11...Bf6 asks for a repetition. White does not repeat.",
      "23": "12.Qxf6. The queen is taken after a knight check. Two pieces and the dark squares are the payment.",
      "41": "21.Nxf6 keeps giving pieces to keep the bind.",
      "57": "29.Rh8+ forces the king into a fork that wins the queen back.",
    },
    pgn: `[Event "Rostov"]
[White "Nezhmetdinov, Rashid"]
[Black "Chernikov, Oleg"]
[Result "1-0"]

1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 g6 5. Nc3 Bg7 6. Be3 Nf6 7. Bc4 O-O
8. Bb3 Ng4 9. Qxg4 Nxd4 10. Qh4 Qa5 11. O-O Bf6 12. Qxf6 Ne2+ 13. Nxe2 exf6
14. Nc3 Re8 15. Nd5 Re6 16. Bd4 Kg7 17. Rad1 d6 18. Rd3 Bd7 19. Rf3 Bb5
20. Bc3 Qd8 21. Nxf6 Be2 22. Nxh7+ Kg8 23. Rh3 Re5 24. f4 Bxf1 25. Kxf1 Rc8
26. Bd4 b5 27. Ng5 Rc7 28. Bxf7+ Rxf7 29. Rh8+ Kxh8 30. Nxf7+ Kh7 31. Nxd8 Rxe4
32. Nc6 Rxf4+ 33. Ke2 1-0`,
  },
  {
    slug: "kasparov-anand-1995",
    title: "Kasparov vs Anand, 1995",
    white: "Garry Kasparov",
    black: "Viswanathan Anand",
    event: "World Championship, New York, game 10",
    year: 1995,
    result: "1-0",
    hook: "A prepared Open Spanish: 14.Bc2 and 17.Qg4, analyzed at home.",
    intro:
      "Game 10 of the 1995 PCA match at the World Trade Center. Kasparov’s prepared 14.Bc2 and 17.Qg4 were played in minutes. Anand’s extra rook does not survive the bishops on e6 and h6.",
    criticalPly: 33,
    takeOverColor: "white",
    takeOverElo: 1700,
    comments: {
      "21": "11.Ng5 is the Open Spanish line Kasparov had ready.",
      "27": "14.Bc2 leaves the a1-rook hanging after ...Qxc3.",
      "33": "17.Qg4 offers the other rook. Taking on a1 walks into Bxe6 and Bh6.",
      "41": "21.Bxh8. White is a piece up. The rest is the extra pawns.",
    },
    pgn: `[Event "World Championship"]
[White "Kasparov, Garry"]
[Black "Anand, Viswanathan"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4 6. d4 b5 7. Bb3 d5
8. dxe5 Be6 9. Nbd2 Nc5 10. c3 d4 11. Ng5 dxc3 12. Nxe6 fxe6 13. bxc3 Qd3
14. Bc2 Qxc3 15. Nb3 Nxb3 16. Bxb3 Nd4 17. Qg4 Qxa1 18. Bxe6 Rd8 19. Bh6 Qc3
20. Bxg7 Qd3 21. Bxh8 Qg6 22. Bf6 Be7 23. Bxe7 Qxg4 24. Bxg4 Kxe7 25. Rc1 c6
26. f4 a5 27. Kf2 a4 28. Ke3 b4 29. Bd1 a3 30. g4 Rd5 31. Rc4 c5 32. Ke4 Rd8
33. Rxc5 Ne6 34. Rd5 Rc8 35. f5 Rc4+ 36. Ke3 Nc5 37. g5 Rc1 38. Rd6 1-0`,
  },
  {
    slug: "morphy-anderssen-1858",
    title: "Morphy vs Anderssen, 1858",
    white: "Paul Morphy",
    black: "Adolf Anderssen",
    event: "Paris match, game 9",
    year: 1858,
    result: "1-0",
    hook: "Morphy beats the Immortal’s author in a seventeen-move Sicilian.",
    intro:
      "Game 9 of the 1858 Paris match. Morphy answers Anderssen’s Sicilian with a piece sacrifice on c7 and mates in the center. Anderssen was the strongest player Morphy met in Europe.",
    criticalPly: 20,
    takeOverColor: "white",
    takeOverElo: 1500,
    comments: {
      "14": "7.Be3 and 8.N1c3 dare Black to push ...f4.",
      "20": "10.Nbc7+ is the fork that decides the opening.",
      "30": "The king is on f6 and every white piece still has a check.",
    },
    pgn: `[Event "Paris"]
[White "Morphy, Paul"]
[Black "Anderssen, Adolf"]
[Result "1-0"]

1. e4 c5 2. d4 cxd4 3. Nf3 Nc6 4. Nxd4 e6 5. Nb5 d6 6. Bf4 e5 7. Be3 f5
8. N1c3 f4 9. Nd5 fxe3 10. Nbc7+ Kf7 11. Qf3+ Nf6 12. Bc4 Nd4 13. Nxf6+ d5
14. Bxd5+ Kg6 15. Qh5+ Kxf6 16. fxe3 Nxc2+ 17. Ke2 1-0`,
  },
];
