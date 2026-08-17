/** Light / dark fills matching `--board-light` / `--board-dark` in globals.css. */
export const BOARD_LIGHT = "#e8d9a0";
export const BOARD_DARK = "#6b8f5a";
export const BOARD_HIGHLIGHT = "#d4a017";

const FILES = "abcdefgh";
const PIECE_GLYPH: Record<string, string> = {
  K: "\u2654",
  Q: "\u2655",
  R: "\u2656",
  B: "\u2657",
  N: "\u2658",
  P: "\u2659",
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
};

export type BoardCell = {
  file: number;
  rank: number;
  square: string;
  piece: string | null;
  dark: boolean;
};

export type BoardSvgOptions = {
  size?: number;
  highlights?: readonly string[];
  labels?: boolean;
  title?: string;
};

function squareName(file: number, rank: number): string {
  return `${FILES.charAt(file)}${rank + 1}`;
}

/** Parse the piece-placement field of a FEN (or a full FEN). */
export function parseFenPlacement(fen: string): BoardCell[] | null {
  const placement = fen.trim().split(/\s+/)[0];
  if (!placement) return null;
  const ranks = placement.split("/");
  if (ranks.length !== 8) return null;

  const cells: BoardCell[] = [];
  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    const rank = 7 - rankIndex;
    const row = ranks[rankIndex];
    if (!row) return null;
    let file = 0;
    for (const ch of row) {
      if (file > 7) return null;
      if (ch >= "1" && ch <= "8") {
        const empty = Number(ch);
        for (let i = 0; i < empty; i += 1) {
          if (file > 7) return null;
          cells.push({
            file,
            rank,
            square: squareName(file, rank),
            piece: null,
            dark: (file + rank) % 2 === 0,
          });
          file += 1;
        }
        continue;
      }
      if (!PIECE_GLYPH[ch]) return null;
      cells.push({
        file,
        rank,
        square: squareName(file, rank),
        piece: ch,
        dark: (file + rank) % 2 === 0,
      });
      file += 1;
    }
    if (file !== 8) return null;
  }
  return cells;
}

export function pieceGlyph(piece: string): string {
  return PIECE_GLYPH[piece] ?? piece;
}

/**
 * Server-safe SVG diagram. No client JS. Coordinates are optional so
 * crawlers and LLM extractors see a self-contained image.
 */
export function renderBoardSvg(
  fen: string,
  options: BoardSvgOptions = {},
): string | null {
  const cells = parseFenPlacement(fen);
  if (!cells) return null;

  const size = options.size ?? 360;
  const labels = options.labels ?? true;
  const margin = labels ? 18 : 0;
  const board = size;
  const total = board + margin;
  const sq = board / 8;
  const highlight = new Set(
    (options.highlights ?? []).map((s) => s.toLowerCase()),
  );
  const title = options.title ?? "Chess position";

  const squares = cells
    .map((cell) => {
      const x = cell.file * sq;
      const y = (7 - cell.rank) * sq;
      const fill = highlight.has(cell.square)
        ? BOARD_HIGHLIGHT
        : cell.dark
          ? BOARD_DARK
          : BOARD_LIGHT;
      const glyph = cell.piece ? pieceGlyph(cell.piece) : "";
      const text = glyph
        ? `<text x="${x + sq / 2}" y="${y + sq / 2}" text-anchor="middle" dominant-baseline="central" font-size="${sq * 0.72}" font-family="Georgia, 'Noto Sans Symbols 2', 'Segoe UI Symbol', serif">${glyph}</text>`
        : "";
      return `<rect x="${x}" y="${y}" width="${sq}" height="${sq}" fill="${fill}"/>${text}`;
    })
    .join("");

  let labelMarkup = "";
  if (labels) {
    for (let file = 0; file < 8; file += 1) {
      labelMarkup += `<text x="${file * sq + sq / 2}" y="${board + 13}" text-anchor="middle" font-size="11" fill="#3d4f3a" font-family="ui-sans-serif, system-ui, sans-serif">${FILES.charAt(file)}</text>`;
    }
    for (let rank = 0; rank < 8; rank += 1) {
      labelMarkup += `<text x="${board + 9}" y="${(7 - rank) * sq + sq / 2}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#3d4f3a" font-family="ui-sans-serif, system-ui, sans-serif">${rank + 1}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title>${squares}${labelMarkup}</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
