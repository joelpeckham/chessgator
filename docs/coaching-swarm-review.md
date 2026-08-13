# ChessGator coaching swarm review

Fifty Grok 4.6 reviewers each read one full Lichess game of ChessGator coach copy, as a skeptical 800–1400 learner. They judged every move on chess truth and on whether a human would actually learn from the sentence. This file is the deduplicated result.

## Method

1. Pulled 50 rated, computer-analyzed Lichess games (standard chess, both players 1100–1800).
2. Replayed every ply through `selectTeachingInsight` using Lichess evals and `best` moves.
3. Launched **50 Grok 4.6 subagents**, one game each. Rubric: beginner–intermediate learner, technical chess plus human-aesthetic, suggestions must fit the deterministic pipeline (facts → reasons → discourse → templates / phrase-bank). No runtime LLM.
4. Clustered 400 raw suggestions by meaning, not by wording.

Raw reviews: `scripts/fixtures/lichess-game-reviews/`. Game dumps: `scripts/fixtures/lichess-game-coaching/`.

## Corpus

| | |
|---|---|
| Games | 50 |
| Plies coached | 2,692 |
| Rating band | 1131–1800 (mean 1532) |
| Time controls | 45 blitz, 4 rapid, 1 classical |
| Reviewers | 50 Grok 4.6 agents |

Reviewers flagged **1,299 / 2,692 plies** (~48%). Each review was capped at the 25 worst flags, so the true annoyance rate on long games is higher. High-severity flags were mostly `wrong_chess` (350) and `missing_lesson` (244), not tone.

Mean `okShare` across games was **0.49**. The coach is not failing to emit English. It is emitting English that is often the wrong lesson.

## Verdict

From a 1200’s chair, the pipeline already has the right bones: named pins, real forks, castle copy that mentions both king and rook, and the occasional clean “the bishop was undefended.” Those lines teach.

The rest of the dump sounds like a template farm that counted attackers and then guessed. Recaptures are sold as winning material. Retreats “save the piece” on the square it just arrived at. Blunders are explained with the capture’s upside. Quiet best moves print “is the strongest move” and stop. Famous ideas (King’s Gambit, Albin, fork trick, Qh4+) are taught as hanging pawns.

A learner who believes this coach will memorize slogans that a defender-count on the board immediately falsifies. That is worse than silence.

---

## Deduplicated suggestions

Ranked by how many games independently asked for the same fix. Feasibility is the agents’ own rating against the current stack.

### 1. Recapture is not a hanging piece (50/50 games)

**Problem.** Equal trades and 2-vs-1 captures are verbalized as “the pawn was undefended,” “you come out a bishop ahead,” or “you lose a knight.” `wins_material` / hanging copy fires on SEE of a pawn’s value even when the unit has defenders.

**Learner quote.** *“e5 is defended by the d5 pawn. Calling it undefended is a lie; I would recapture in a heartbeat.”* (Albin, `YOQhhtUj`)

**Fix.** Gate `undefended` on defender count === 0. Gate `wins_material` on **net** SEE after the recapture, not the captured unit’s sticker price. If attackers > defenders, say “attacked more times than it was guarded.” Suppress recapture-as-benefit when the previous ply was the capture of that unit.

**Layer:** reasons + templates. **Feasibility:** high.

### 2. Name the square the piece fled from (37/50)

**Problem.** `saves_piece` uses `ownedPhrase` on the **destination**, so `Bc4` becomes “saves your c4-bishop.” That is a tautology. The learner already sees where it is.

**Fix.** For `retreatedToSafety`, label origin (`saves your bishop from a6`) or drop the square (`saves your bishop`). Destination naming should be a hard fail in golden tests.

**Layer:** templates / move-copy. **Feasibility:** high.

### 3. Never emit a verdict with no because (33/50)

**Problem.** “Moving your pawn to d3 is the strongest move.” “A better move would have been a3.” Empty `playedBecause` / `suggestedBecause` still renders. On forcing ideas (unpin, pawn break, covering h4) this is a shrug. On blunders it is a SAN with a scolding.

**Fix.** If the renderer has no because-clause, drop “strongest move” / “would be better” or substitute a fallback fact (threat answered, piece developed, check blocked). Treat empty because on `best_move` and on any suggested SAN as a render error in tests.

**Layer:** discourse + templates. **Feasibility:** high.

This also covers the sibling request: **always explain the suggested move** (why Nf3, not just “Nf3”). If `suggestedBecause` is null, run benefit pickers on the suggested move before giving up.

### 4. Kill “you can likely take a pawn” (23/50)

**Problem.** `likely: true` PV events become the because-clause of quiet moves and of the *alternative*. Openings get “d4 would be better because you can likely take a pawn.” Blunders get ghost pins from move 3 of the engine line, attached to move 1.

**Fix.** Only attach tactics the **suggested ply itself** creates. “Likely take” requires the capture to be legal on the next ply with SEE ≥ a pawn, not a later PV capture. Do not pin PV-later pins/forks on the first SAN.

**Layer:** reasons (`verifyLikelyTactics`) + discourse. **Feasibility:** high.

### 5. Print the hanging unit, not a SEE bucket (20/50)

**Problem.** `hangingLossCopy` maps ~200cp to “the exchange” and ~300cp to “a knight.” Bishops, queen-for-nothing, and knight-for-pawn all come out as the wrong noun. Reviewers stopped trusting later tactic labels after one wrong piece name.

**Fix.** Prefer `NamedUnit.type` of the hanging piece. Use the material bucket only when unit type and SEE disagree by more than a pawn. Rook-for-knight should still say “the exchange.”

**Layer:** templates / move-copy. **Feasibility:** high.

### 6. Stop defaulting to center control (17/50)

**Problem.** `e3`, `c3`, `Qf6`, KID `…f5`, and Italian `h3` all “claim more of the center.” Phrase-bank variants do not save a slogan that is the wrong idea.

**Fix.** Suppress `center_control` when a higher-value reason exists (kick, pin-break, check cover, pawn break, development with tempo). Add cheap plan reasons: **pawn break** (`c5`/`d5`/`e6`/`f5`), **fianchetto**, **unpin**, **hits the queen**. Opening pawn two-squares in the first few plies should not be scored as hanging (King’s Gambit / Albin).

**Layer:** reasons + phrase-bank. **Feasibility:** high for gating; medium for new plan reasons.

### 7. Mate is mate (14/50)

**Problem.** Mate-in-1 described as a fork or pin. Mate sentence printed twice (`forces_mate` + consequence). “Allows mate” restated as “you can get mated.” Conversion of a mate net taught as taking a side pawn.

**Fix.** If `forces_mate` / `allows_mate` is present, it is the only because. Deduplicate the consequence. Do not let `fork`/`pin` outrank mate. Suggested alternatives that stop mate must say so.

**Layer:** discourse + templates. **Feasibility:** high.

### 8. Do not explain a blunder with its upside (13/50)

**Problem.** Polarity bug: inaccuracy/mistake/blunder still gets benefit because-clauses. `Bh4+` “is a mistake because it forces the king to respond.” `Nxe5` “because the pawn was undefended.” `O-O` “failed because it shelters the king.” The learner hears praise glued to a punishment.

**Fix.** `explainPlayedAsBenefit` must be false for teachable classifications. Because-clause for mistakes comes from `pickProblemReasons` / refutation punchline, never leftover `capture`/`check`/`king_safer` on the played move. If the capture was the mistake, say what the recapture or zwischenzug does, not that the pawn was free.

**Layer:** discourse (`select-insight.ts`). **Feasibility:** high.

### 9. Gate `removed_defender` (13/50)

**Problem.** Copy says you took “the defender of X” when the captured unit did not guard X, or X does not hang after the capture.

**Fix.** Require: captured unit attacks the named target **before** the move, and the target is hanging (SEE < 0 for its owner) **after**. Same bar for “unveils an attack” discoveries onto safe pawns.

**Layer:** facts / tactics. **Feasibility:** high.

### 10. Drop incidental pins, forks, and skewers (many games; same pattern)

**Problem.** Relative pawn-to-rook pins, recapture-with-check called a fork, blocks called skewers, forks that die on the recapture. These crowd out the real lesson (check, hanging queen, pawn kick).

**Fix.** Emit pin/fork/skewer only if the tactic is usable: absolute pin, or relative pin of a piece to a more valuable one that the mover can exploit this ply; fork of two pieces that are both hanging or king+piece; skewer that wins the rear unit. Demote pawn-to-rook pins below check, queen attacks, and hanging pieces.

**Layer:** facts (motifs) + reason severity. **Feasibility:** high.

### 11. “Strongest move” must not fire on a swing (classification)

**Problem.** `classifyPlayedMove` forces `best` when the played UCI matches Lichess `best`, even if `evalLossCp` is 40–387. Combined with missing MultiPV, quiet inaccuracies become “That’s the one.”

**Fix.** Cap the best-override (e.g. only if loss ≤ `excellentMaxLossCp`). If the dump has no alternative PV, do not claim uniqueness. Do not print `still_winning` / “keeps you winning” on a blunder.

**Layer:** classification + eval-frame gating. **Feasibility:** high.

Caveat for this corpus: dumps used Lichess single-best, not Stockfish MultiPV, so some empty “strongest” lines are missing-engine rather than missing-copy. The override bug is still real whenever eval and UCI disagree.

### 12. Lead with check, kick, and hang — in that order

Scattered across games, same priority complaint:

- If the move is check, say check before pin/center/save.
- If a pawn hits a queen or bishop, that is the lesson (`kicked_by_pawn` as a **benefit** for the mover, not only a problem).
- If something hangs, name the most expensive hanging unit (including a queen revealed by a discovery). Structure (`backward_pawn`, `pawn_shield`) must not outrank piece safety.
- King walks out of check are “getting out of check,” not `saves_piece` / `king_safer`.
- Endgame king marches are activity, not “your king is more exposed.”

**Layer:** reason severity + a few new benefit kinds. **Feasibility:** high.

### 13. Opening and endgame plans the detectors do not have

Agents asked for facts that are missing, not just copy tweaks:

| Idea | Why a 1200 noticed |
|---|---|
| Gambit / intentional pawn offer | King’s Gambit and Albin taught as hanging pawns |
| Pawn forks of two pieces | Fork trick (`Nxe4` then `d5`) taught as an undefended e4 pawn |
| Zwischenzug / in-between check | Recapture assumed; the check in between is the whole point |
| Fianchetto, support pawn, opposite-side storm | Generic center slogans on `…g6` / `h3` / `…f5` |
| Passed pawn: create vs push | “Creates a passer” on a pawn that was already passed |
| Perpetual / repetition | Draw by checks taught as random checks |
| Block-check vs flee | `g4` interposing called king safety |

**Layer:** facts. **Feasibility:** medium (each is a bounded detector).

### 14. Grammar and cadence (aesthetic, still cheap)

- Follow-up clauses need a finite verb: “and then pin another pawn” is not English.
- Do not concatenate the same tactic twice (`fork` + `fork`).
- Phrase-bank “it forces the king to respond” is a tautology for check; drop it or reserve it for discovered check.
- Quips (“That’s the one.” / “There’s better.”) on a wrong lesson make the mascot look like it is mocking the player.
- Always name pawn squares (`the d4 pawn`, not “the pawn”).

**Layer:** phrase-bank + templates. **Feasibility:** high.

---

## Aesthetic pattern (across technical bugs)

Even when the chess is not outright false, the voice is:

1. **Mad Libs.** Same three center-control sentences, same “strongest move” cadence, same “your g1-knight.”
2. **Destination tautology.** Saving the c4-bishop by moving it to c4.
3. **Invented vividness.** “Likely pin,” “likely take,” “unveils an attack” on a pawn that is covered three times.
4. **Praise/punish collision.** Verdict says mistake; because-clause says you took a free pawn.
5. **Empty authority.** Engine SAN with no idea. A 1200 can get that from the eval bar.

What already works, and should be the quality bar:

- Absolute pins named with both pieces (“pin the knight to the king”).
- Real forks (king+rook, queen+bishop) in one clause.
- Castling: king tucks, rook comes in.
- True hanging takes: “the bishop was undefended.”
- Outpost / open-file lines when they are the actual idea.
- Royal forks and mate nets when they are allowed to win the reason ranking.

---

## Implementation order

Do these first. They are local gates, they showed up in almost every game, and they stop the coach from lying.

1. **Recapture / `undefended` / net SEE** for `wins_material`.
2. **Benefit polarity** on inaccuracy/mistake/blunder.
3. **Origin-square `saves_piece`.**
4. **Empty-because render ban** (played and suggested).
5. **`likely` tactics = this ply only.**
6. **Hanging copy uses the unit’s piece type.**
7. **`removed_defender` must actually defend, and the target must hang.**
8. **Pin/fork/skewer usability gate.**
9. **Reason ranking:** mate > check > hanging (highest value) > kick > pin > structure > center.
10. **Best-override cap** on eval loss.
11. Then add detectors: pawn fork, pawn break, gambit-offer, zwischenzug, block-check, endgame king activity.

Golden tests should be promoted from the swarm flags, not from puzzles. The worst failures in this run were full-game phenomena (recapture sequences, opening names, mate conversion) that motif fixtures do not cover.

## Limits of this run

- Coach evals came from Lichess analysis, not the in-app Stockfish MultiPV. Some “no because on the alternative” lines will look better in product if MultiPV supplies a real PV.
- Copy always says “your,” as if the mover is the student. That matches in-app
  coaching of the human’s moves, but this dump includes both sides.
- Reviewers were instructed to be harsh. The 48% flag rate is not “half the product is unshippable”; it is “half the plies failed a picky 1200.” The high-severity wrong-chess cluster is the part that is unshippable.
