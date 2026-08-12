import { GameShellClient } from "@/components/game/game-shell-client";

/**
 * Build-time static shell. All browser APIs, workers, and interactivity live
 * under the client `GameShell` boundary.
 */
export default function Home() {
  return <GameShellClient />;
}
