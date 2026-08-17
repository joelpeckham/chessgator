import {
  type BoardOrientation,
  parseFenPlacement,
  pieceGlyph,
} from "@/lib/board-svg";
import { cn } from "@/lib/utils";

/** Same tokens as ChessboardAdapter / board-surface — never a second palette. */
const SQUARE_LIGHT = "var(--board-light)";
const SQUARE_DARK = "var(--board-dark)";
const SQUARE_HIGHLIGHT = "var(--board-arrow)";
const LABEL_FILL = "var(--foreground)";

export type StaticBoardProps = {
  fen: string;
  title?: string;
  highlights?: readonly string[];
  labels?: boolean;
  orientation?: BoardOrientation;
  className?: string;
};

/**
 * Server-rendered chess diagram. Inline SVG so crawlers and LLM extractors
 * see the position without client JavaScript.
 */
export function StaticBoard({
  fen,
  title = "Chess position",
  highlights,
  labels = true,
  orientation = "white",
  className,
}: StaticBoardProps) {
  const cells = parseFenPlacement(fen);
  if (!cells) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not render this position.
      </p>
    );
  }

  const highlight = new Set((highlights ?? []).map((s) => s.toLowerCase()));
  const size = 360;
  const margin = labels ? 18 : 0;
  const total = size + margin;
  const sq = size / 8;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={title}
      className={cn("mx-auto h-auto w-full max-w-sm", className)}
    >
      <title>{title}</title>
      {cells.map((cell) => {
        const file = orientation === "black" ? 7 - cell.file : cell.file;
        const rank = orientation === "black" ? 7 - cell.rank : cell.rank;
        const x = file * sq;
        const y = (7 - rank) * sq;
        const fill = highlight.has(cell.square)
          ? SQUARE_HIGHLIGHT
          : cell.dark
            ? SQUARE_DARK
            : SQUARE_LIGHT;
        return (
          <g key={cell.square}>
            <rect x={x} y={y} width={sq} height={sq} fill={fill} />
            {cell.piece ? (
              <text
                x={x + sq / 2}
                y={y + sq / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={sq * 0.72}
                fontFamily="Georgia, 'Noto Sans Symbols 2', 'Segoe UI Symbol', serif"
              >
                {pieceGlyph(cell.piece)}
              </text>
            ) : null}
          </g>
        );
      })}
      {labels
        ? Array.from({ length: 8 }, (_, file) => (
            <text
              key={`file-${file}`}
              x={file * sq + sq / 2}
              y={size + 13}
              textAnchor="middle"
              fontSize={11}
              fill={LABEL_FILL}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {String.fromCharCode(
                97 + (orientation === "black" ? 7 - file : file),
              )}
            </text>
          ))
        : null}
      {labels
        ? Array.from({ length: 8 }, (_, rank) => (
            <text
              key={`rank-${rank}`}
              x={size + 9}
              y={(7 - rank) * sq + sq / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fill={LABEL_FILL}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {orientation === "black" ? 8 - rank : rank + 1}
            </text>
          ))
        : null}
    </svg>
  );
}
