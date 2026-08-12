# chessgator

A **local-only** chess coach you can play in the browser. Maia is the human-like
opponent; Stockfish provides objective coaching analysis. Games, settings, and
engine work stay on your device — the production build is a static export with
no accounts, APIs, or runtime backend. Production is intended at
[chessgator.com](https://chessgator.com) (custom domain on Vercel).

## Stack

- Next.js 16 (App Router) + React 19 + React Compiler + TypeScript + Tailwind CSS 4 + shadcn/ui
- Package manager: [Bun](https://bun.sh)
- Rules: `chess.js`
- Opponent: Maia3 5M (ONNX Runtime Web)
- Analysis: Stockfish 18 lite single-thread (WASM worker)
- State: Zustand store over a branch-capable game tree
- Persistence: compact localStorage (`chessgator:game:v2`)

## Architecture

```
src/
  domain/game/        # rules, immutable tree, variation explorer
  domain/analysis/    # classifications + move evidence
  domain/teaching/    # insights and progressive hints
  engines/maia/       # MaiaClient + worker protocol
  engines/stockfish/  # StockfishClient + UCI queue (coaching only)
  features/game/      # Zustand store, GameShell, Maia/coaching sessions
  storage/            # compact v2 reconstruct-on-load persistence
  components/         # board, coach, timeline, UI primitives
```

Play as White against Maia. Engines warm as soon as the page loads and a game
starts automatically. After each move, Stockfish coaches through dismissible
tutor cards. The branching timeline under the board is the main way to review
the past, preview engine futures, and try tutor alternatives. Timeline review
is ephemeral: scrubbing does not move the live game pointer. Closing the tab
resumes the local game from `localStorage`.

## Prerequisites

- Bun 1.3+
- Network access once to download the pinned Maia ONNX model (≈10 MB)

## Setup

```bash
bun install
bun run prepare:assets
```

`prepare:assets` copies Stockfish and versioned ONNX Runtime Web binaries from
the installed packages, downloads the commit-pinned Maia3 5M fp16 model (content-
addressed filename), asserts installed package versions match
[`assets.lock.json`](./assets.lock.json), and verifies SHA-256 checksums.
Generated files land in `public/engine/`, `public/ort/<version>/`, and
`public/models/` (gitignored).

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Next.js development server |
| `bun run prepare:assets` | Fetch/copy + verify engine/ORT/model assets |
| `bun run format` | Biome format + organize imports (write) |
| `bun run format:check` | Biome CI format gate |
| `bun run lint` | Oxlint, then ESLint (React Compiler / typed / boundaries) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run knip` | Unused files and dependency gate |
| `bun run check` | format:check + lint + typecheck + knip + unit tests |
| `bun run analyze` | Next.js Turbopack bundle analyzer (`next experimental-analyze`) |
| `bun run test` | Vitest unit tests |
| `bun run test:static-host` | Cache-header / asset-path gate (needs `out/`) |
| `bun run test:stockfish` | Real Stockfish worker/WASM browser smoke |
| `bun run test:maia` | Real Maia worker/ONNX browser smoke |
| `bun run test:game` | Playable-slice e2e (stub Maia) |
| `bun run test:coaching` | Coaching-slice e2e (stub engines) |
| `bun run test:time-travel` | Branching timeline + tutor alternate e2e |
| `bun run test:persistence` | Local resume / corruption e2e |
| `bun run test:accessibility` | Keyboard / live region / layout smoke |
| `bun run test:composed` | Composed shell smoke with real Maia/Stockfish |
| `bun run build` | Prepare assets, then static `next build` → `out/` |

Quality tooling: Biome (format), Oxlint (fast lint), ESLint (React Compiler
rules, type-aware TypeScript, architecture boundaries), stricter `tsc`, Knip,
and Next.js React Compiler (`reactCompiler: true`). Lefthook runs Biome + Oxlint
on staged files; VS Code settings recommend Biome + ESLint + Oxc.

Serve the `out/` directory with any static host after a production build.
`next start` is not used — there is no Node server in production.

Browser CI gates currently use Chromium. Firefox/WebKit and physical-tablet
coverage are nonblocking v1 limits.

## Licenses

Stockfish.js is GPL-3.0; the Maia3 ONNX export used here is AGPL-3.0. See
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for exact source links and
redistribution notes.

## Product direction

See [`ROADMAP.md`](./ROADMAP.md) for the shipped local-only baseline and what is
intentionally out of scope.
