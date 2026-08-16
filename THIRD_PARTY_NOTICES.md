# Third-party notices

This project bundles or downloads third-party chess engines and models for
**local, in-browser use**. Exact pinned URLs and SHA-256 checksums live in
[`assets.lock.json`](./assets.lock.json). Generated binaries under `public/`
are not committed to git; run `bun run prepare:assets` after install.

## Stockfish.js (GPL-3.0)

- **What**: Stockfish 18 WASM chess engine, lite single-thread build
  (`stockfish-18.0.8-lite-single.js` / `.wasm`)
- **npm package**: [`stockfish`](https://www.npmjs.com/package/stockfish) `18.0.8`
- **Upstream project**: [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js)
- **Engine lineage**: [official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish)
- **License**: GNU General Public License v3.0
  - Package copy: `node_modules/stockfish/Copying.txt`
  - Canonical text: <https://www.gnu.org/licenses/gpl-3.0.html>
  - Upstream notice: <https://raw.githubusercontent.com/nmrugg/stockfish.js/master/Copying.txt>
- **How we use it**: Files are copied from the installed npm package into
  `public/engine/` at prepare/build time and loaded in a browser worker.
  This portfolio build ships the GPL-covered engine as redistributed binaries;
  corresponding source is available via the links above and the npm package.

## Maia3 5M ONNX (AGPL-3.0)

- **What**: Browser-ready Maia3 5M fp16 ONNX export (served as
  `maia3-5m.fp16.ca22fc303197.onnx`)
- **Pinned artifact**:
  <https://huggingface.co/bqrio/maia3-onnx/blob/f2582c005a63a034e493d93736ecdd6291dd82e7/maia3-5m.fp16.onnx>
- **Download URL (commit-pinned)**:
  <https://huggingface.co/bqrio/maia3-onnx/resolve/f2582c005a63a034e493d93736ecdd6291dd82e7/maia3-5m.fp16.onnx>
- **ONNX repository**: [bqrio/maia3-onnx](https://huggingface.co/bqrio/maia3-onnx) (license: AGPL-3.0)
- **Upstream weights**: [UofTCSSLab/Maia3-5M](https://huggingface.co/UofTCSSLab/Maia3-5M)
- **Upstream code**: [CSSLab/maia3](https://github.com/CSSLab/maia3)
  - License text: <https://raw.githubusercontent.com/CSSLab/maia3/main/LICENSE>
  - Canonical AGPL text: <https://www.gnu.org/licenses/agpl-3.0.html>
- **How we use it**: Downloaded into `public/models/` at prepare/build time under
  a content-addressed filename and run client-side with `onnxruntime-web`. For
  this portfolio version, treat the Maia integration as AGPL-covered and keep
  integration source available with the project. Revisit licensing before any
  proprietary or paid distribution.

## ONNX Runtime Web (MIT)

- **What**: WASM / JSEP runtime binaries used by the Maia worker
- **Package**: `onnxruntime-web` (version pinned in `assets.lock.json`)
- **How we use it**: Copied into `public/ort/<version>/` with SHA-256 verification
  and served under a versioned immutable cache path.

## Other runtime libraries

Application dependencies (`chess.js`, `react-chessboard`, Next.js, React, etc.)
remain under their respective package licenses in `node_modules/*/LICENSE*`.
