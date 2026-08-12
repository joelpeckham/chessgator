# Chess Tutor

A **local-only** chess coach you can play in the browser. Maia is the primary
human-like opponent; Stockfish provides objective analysis. Games, settings, and
engine work stay on your device — the production build is a static export with
no accounts, APIs, or runtime backend.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- Package manager: [Bun](https://bun.sh)
- Rules: `chess.js`
- Opponent: Maia3 5M (ONNX Runtime Web)
- Analysis: Stockfish 18 lite single-thread (WASM worker)

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
| `bun run lint` | ESLint |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run test` | Vitest unit tests (includes static-host config checks) |
| `bun run test:stockfish` | Real Stockfish worker/WASM browser smoke |
| `bun run test:maia` | Real Maia worker/ONNX browser smoke |
| `bun run test:game` | Playable-slice e2e (stub engines) |
| `bun run test:composed` | Composed shell smoke with real Maia/Stockfish |
| `bun run build` | Prepare assets, then static `next build` → `out/` |

Serve the `out/` directory with any static host after a production build.
`next start` is not used — there is no Node server in production.

Browser CI gates currently use Chromium. Firefox/WebKit and physical-tablet
coverage are nonblocking v1 limits.

## Licenses

Stockfish.js is GPL-3.0; the Maia3 ONNX export used here is AGPL-3.0. See
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for exact source links and
redistribution notes.

## Product direction

See [`ROADMAP.md`](./ROADMAP.md) for the local-only implementation sequence
(domain → Stockfish → Maia → playable slice → coaching → time travel → polish).
