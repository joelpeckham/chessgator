# chessgator — Roadmap

## Vision

Play chess against a human-like AI opponent that coaches you in real time.
After each move, understand what was strong, what was weak, and what would have
been better. Time-travel through a branch-capable game tree, and preview ghost
futures — engine refutations stepped out in front of you — before you commit.

Everything runs locally in the browser. No accounts, no server, no API keys.
The deployed app is a static export: HTML, JavaScript, CSS, WASM, and an ONNX
model on a cheap static host.

## Shipped baseline (v1)

A user can open the static site, start a game, play a complete legal game against
Maia at a chosen Elo, get a useful explanation and line after mistakes, explore
a better line as ghost futures, take back and retry, close the tab, and resume
later. Production build, unit tests, and browser smoke tests pass. No runtime
request depends on an application server.

### Architecture

- **Stack**: Next.js 16 (App Router, `output: "export"`) + React 19 + TypeScript
  + Tailwind CSS 4 + shadcn/ui, managed with Bun.
- **Chess rules**: `chess.js` — sole rules authority (legal moves, FEN/SAN/UCI).
- **Board**: `react-chessboard` — presentation only; every proposed move is
  validated by `chess.js`.
- **State**: Zustand store owns the tree pointer and session mode; pure domain
  helpers in `domain/game` mutate the immutable tree / variations.
- **Persistence**: compact `SavedGameV2` in localStorage (`chessgator:game:v2`) —
  UCI branch adjacency reconstructed into a live tree on hydrate.
- **Assets**: Reproducible prepare script + [`assets.lock.json`](./assets.lock.json)
  for Stockfish lite-single and the Maia3 5M fp16 browser model.

### Division of labor: Maia vs Stockfish

- **Maia-3 5M (ONNX Runtime Web)** — sole opponent. Elo-conditioned move
  prediction; one forward pass per move. Init failure is a hard error.
- **Stockfish 18 (WASM, Web Worker, lite single-thread)** — coaching only:
  evals, MultiPV lines, classifications, and ghost-future refutations. Served
  from `public/engine/`.

### Core concepts

- **Game tree** — immutable nodes `{ id, parentId, childIds, fen, move, ply, isVariation }`.
  Time travel moves `currentNodeId`; alternate moves create branches.
- **Session mode** — plain enum (`loading` | `playerTurn` | `opponentThinking` |
  `analyzing` | `reviewing` | `gameOver` | `error`) owned by the store.
- **Teaching pipeline** — Stockfish evidence → `TeachingInsight` → coach UI.
  Components never turn raw UCI/ONNX output into prose.
- **Workers** — Stockfish and Maia in separate workers with typed protocols,
  request IDs, cancellation, and game-node IDs so stale results cannot apply.

### Ownership map

```
chessgator/
  public/engine/              # stockfish lite-single (generated, gitignored)
  public/ort/<version>/       # onnxruntime-web WASM (generated, gitignored)
  public/models/              # content-addressed Maia ONNX (generated, gitignored)
  scripts/prepare-assets.mjs
  assets.lock.json
  src/
    domain/game/              # tree, rules, variation explorer
    domain/analysis/          # evaluations, classifications
    domain/teaching/          # insights, hints, templates
    engines/stockfish/        # coaching client + UCI
    engines/maia/             # opponent client + ONNX encode/mask
    workers/                  # worker entry points only
    features/game/            # Zustand store, GameShell, sessions
    storage/                  # compact v2 localStorage
    components/               # board, coach, timeline, UI primitives
  tests/shared/               # app static server + Playwright helpers
```

## Out of scope for v1

Accounts, backend APIs, cloud sync, LLM prose, monetization, multi-threaded
Stockfish, Stockfish-as-opponent fallback, large curriculum, multi-game library,
playing as Black.

## Nonblocking limits (documented, not release gates)

- Chromium-only automated browser matrix (Firefox/WebKit not CI-gated).
- Tablet support is viewport smoke only; no physical-tablet claim.
- Official Python Maia parity is structural/local only — not bit-exact CI.
- Temporary ghost variation nodes are not persisted across reload.

## Risks

- **Asset drift** — mitigate with commit-pinned URLs and SHA-256 in
  `assets.lock.json`; CI always runs `prepare:assets`.
- **Maia load failure** — surfaces as a hard error (no silent Stockfish opponent).
- **Static-export limits** — no runtime image optimization or `headers` in
  `next.config`; configure caching / isolation on the host if needed later.
- **License surface** — GPL (Stockfish) + AGPL (Maia ONNX). Keep notices and
  source links current; revisit before any proprietary product.
