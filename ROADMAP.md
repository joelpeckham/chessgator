# Chess Tutor — Roadmap

## Vision

Play chess against a human-like AI opponent that coaches you in real time.
After each move, understand what was strong, what was weak, and what would have
been better. Time-travel through a branch-capable game tree, and preview ghost
futures — engine refutations stepped out in front of you — before you commit.

Everything runs locally in the browser. No accounts, no server, no API keys.
The deployed app is a static export: HTML, JavaScript, CSS, WASM, and an ONNX
model on a cheap static host.

## Architecture at a glance

- **Stack**: Next.js 16 (App Router, `output: "export"`) + React 19 + TypeScript
  + Tailwind CSS 4 + shadcn/ui, managed with Bun.
- **Chess rules**: `chess.js` — sole rules authority (legal moves, FEN/SAN/UCI).
- **Board**: `react-chessboard` — presentation only; every proposed move is
  validated by `chess.js`.
- **State**: Zustand as a UI adapter around domain commands; persistence through
  a versioned `GameRepository` (localStorage first).
- **Assets**: Reproducible prepare script + [`assets.lock.json`](./assets.lock.json)
  for Stockfish lite-single and the Maia3 5M fp16 browser model.

### Division of labor: Maia vs Stockfish

Maia is first-class in v1. Stockfish is required for coaching and as a fallback.

- **Maia-3 5M (ONNX Runtime Web)** — human-like opponent. Elo-conditioned move
  prediction; one forward pass per move. Primary `OpponentEngine`.
- **Stockfish 18 (WASM, Web Worker, lite single-thread)** — objective truth:
  evals, MultiPV lines, classifications, ghost-future refutations, and
  `StockfishOpponent` if Maia fails to load. Served from `public/engine/` so
  COOP/COEP headers are not required for the first release.

### Core concepts

- **Game tree** — immutable nodes `{ id, parentId, childIds, fen, move, ply, analysis }`.
  Time travel moves `currentNodeId`; alternate moves create branches.
- **Session state machine** — `loading` | `playerTurn` | `opponentThinking` |
  `analyzing` | `reviewing` | `gameOver` | `error`, separate from tree position.
- **Teaching pipeline** — engine evidence → `TeachingInsight` → coach UI.
  Components never turn raw UCI/ONNX output into prose.
- **Workers** — Stockfish and Maia in separate workers with typed protocols,
  request IDs, cancellation, and game-node IDs so stale results cannot apply.

## Implementation sequence

### 1. Static foundation (this pass)

Static export, asset lock + prepare script, notices, package scripts, CI.
**Done when**: `prepare:assets`, lint, typecheck, tests, and `next build`
succeed without a runtime backend.

### 2. Game domain

`chess.js` wrapper, branch-capable tree, session transitions, versioned
persistence contracts, Vitest coverage for legal moves / branching / edge cases.

### 3. Stockfish analysis

Lite single-thread worker, typed UCI client, analysis queue, cancellation,
browser integration tests.

### 4. Maia opponent

Pinned 5M fp16 ONNX in a worker, encoder, legal-move masking, Elo conditioning,
fallback to Stockfish, parity checks vs the Python reference where practical.

### 5. Playable vertical slice

Static shell + client game: play as White vs Maia, Elo selection, loading/error/
game-over, Stockfish fallback if Maia fails.

### 6. Coaching slice

Structured move analysis, progressive hints, teaching cards, show-line,
takeback-and-retry.

### 7. Time travel & polish

Branch timeline, ghost futures, local resume, responsive accessibility, deploy
`out/` to a static host with immutable caching for versioned assets.

## First release definition

A user can open the static site, start a game, play a complete legal game against
Maia at a chosen Elo, fall back to Stockfish if Maia fails, get a useful
explanation and line after mistakes, take back and retry, close the tab, and
resume later. Production build, unit tests, and browser smoke tests pass. No
runtime request depends on an application server.

## Out of scope for v1

Accounts, backend APIs, cloud sync, LLM prose, monetization, multi-threaded
Stockfish, large curriculum, multi-game library.

## Nonblocking limits (documented, not release gates)

- Chromium-only automated browser matrix (Firefox/WebKit not CI-gated).
- Tablet support is viewport smoke only; no physical-tablet claim.
- Official Python Maia parity is structural/local only — not bit-exact CI.
- Dual Stockfish workers (coach + fallback opponent) are accepted for v1.

## Suggested ownership (target map)

```
chess-tutor/
  public/engine/              # stockfish lite-single (generated, gitignored)
  public/ort/<version>/       # onnxruntime-web WASM (generated, gitignored)
  public/models/              # content-addressed Maia ONNX (generated, gitignored)
  scripts/prepare-assets.mjs
  assets.lock.json
  src/
    domain/game/              # tree, moves, session transitions
    domain/analysis/          # evaluations, classifications
    domain/teaching/          # insights, hints, templates
    engines/stockfish/
    engines/maia/
    workers/                  # worker entry points only
    features/game/            # board, controls, coach, timeline
    storage/                  # repository + localStorage adapter
    components/ui/            # shadcn primitives
```

## Risks

- **Asset drift** — mitigate with commit-pinned URLs and SHA-256 in
  `assets.lock.json`; CI always runs `prepare:assets`.
- **Maia load failure** — ship `StockfishOpponent` behind the same interface.
- **Static-export limits** — no runtime image optimization or `headers` in
  `next.config`; configure caching / isolation on the host if needed later.
- **License surface** — GPL (Stockfish) + AGPL (Maia ONNX). Keep notices and
  source links current; revisit before any proprietary product.
