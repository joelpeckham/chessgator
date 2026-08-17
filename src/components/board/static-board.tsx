import {
  BOARD_DARK,
  BOARD_HIGHLIGHT,
  BOARD_LIGHT,
  parseFenPlacement,
  pieceGlyph,
} from "@/lib/board-svg";
import { cn } from "@/lib/utils";

export type StaticBoardProps = {
  fen: string;
  title?: string;
  highlights?: readonly string[];
  labels?: boolean;
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
        const x = cell.file * sq;
        const y = (7 - cell.rank) * sq;
        const fill = highlight.has(cell.square)
          ? BOARD_HIGHLIGHT
          : cell.dark
            ? BOARD_DARK
            : BOARD_LIGHT;
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
              fill="#3d4f3a"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {String.fromCharCode(97 + file)}
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
              fill="#3d4f3a"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {rank + 1}
            </text>
          ))
        : null}
    </svg>
  );
}
