import { allOpeningSlugs, ECO_LETTERS } from "./data";
import { FEATURED_FIRST_MOVES } from "./first-moves";

/**
 * Every static path emitted under /openings.
 * Individual pages: all 3810 Lichess CC0 entries (full dataset).
 */
export function contentPaths(): string[] {
  const paths: string[] = ["/openings"];

  for (const letter of ECO_LETTERS) {
    paths.push(`/openings/eco/${letter.toLowerCase()}`);
  }

  for (const move of FEATURED_FIRST_MOVES) {
    paths.push(`/openings/first-move/${move}`);
  }

  paths.push("/openings/first-move/others");

  for (const slug of allOpeningSlugs()) {
    paths.push(`/openings/${slug}`);
  }

  return paths;
}
