import { CONCEPTS } from "./concepts";

export function contentPaths(): string[] {
  return ["/learn", ...CONCEPTS.map((concept) => `/learn/${concept.slug}`)];
}
