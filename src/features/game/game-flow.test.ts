import { beforeEach, describe, expect, it } from "vitest";
import {
  createInitialTree,
  DEFAULT_POSITION,
  getCurrentNode,
  getMoveHistory,
  getNode,
  playMoveOnTree,
} from "@/domain/game";
import type { GameTree } from "@/domain/game/types";
import { createCoachingController } from "@/features/game/coaching-controller";
import {
  buildSuggestedMove,
  realizeSuggestedMove,
  requestOpponentMove,
  runPostMoveCoaching,
} from "@/features/game/game-flow";
import { useGameStore } from "@/features/game/game-store";
import { createStubAnalysisEngine } from "@/features/game/stub-analysis";
import { createStubMaiaSession } from "@/features/game/stub-maia";

function play(tree: GameTree, uci: string): GameTree {
  const result = playMoveOnTree(tree, tree.currentNodeId, uci);
  if (!result) throw new Error(`Illegal move ${uci}`);
  return result.tree;
}

describe("realizeSuggestedMove", () => {
  it("plays a single suggested UCI and reuses a matching child", () => {
    let tree = createInitialTree();
    tree = play(tree, "d2d4");
    const d4Id = tree.currentNodeId;
    const result = realizeSuggestedMove({
      tree,
      originNodeId: tree.rootId,
      uci: "e2e4",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tree.nodes[result.nodeId]?.move?.uci).toBe("e2e4");
    const origin = getNode(result.tree, result.tree.rootId);
    expect(origin?.childIds).toContain(d4Id);
    expect(origin?.childIds).toContain(result.nodeId);

    const again = realizeSuggestedMove({
      tree: result.tree,
      originNodeId: result.tree.rootId,
      uci: "e2e4",
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.nodeId).toBe(result.nodeId);
    expect(Object.keys(again.tree.nodes).length).toBe(
      Object.keys(result.tree.nodes).length,
    );
  });
});

describe("buildSuggestedMove", () => {
  it("projects a single move from the analyzed human node's parent", () => {
    let tree = createInitialTree();
    tree = play(tree, "d2d4");
    const analyzedId = tree.currentNodeId;
    tree = play(tree, "d7d5");

    const line = buildSuggestedMove(
      tree,
      {
        concept: "missed_improvement",
        confidence: 0.8,
        explanation: "e4 is better because it claims the center.",
        suggestedMoveUci: "e2e4",
        suggestedMoveSan: "e4",
        lineUci: ["e2e4", "e7e5"],
        refutationUci: [],
        classification: "mistake",
        nudge: true,
      },
      analyzedId,
    );
    expect(line).not.toBeNull();
    expect(line!.rootNodeId).toBe(tree.rootId);
    expect(line!.kind).toBe("suggested");
    expect(line!.plies).toHaveLength(1);
    expect(line!.plies[0]?.san).toBe("e4");
  });
});

describe("runPostMoveCoaching", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...useGameStore.getInitialState(),
    });
  });

  it("does not leave analyzing when the flow was superseded", async () => {
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4", { afterMode: "analyzing" });
    const node = getCurrentNode(useGameStore.getState().tree);
    expect(node.move).toBeDefined();
    const coach = createCoachingController({
      createEngine: () => createStubAnalysisEngine({ delayMs: 10 }),
    });
    await coach.start();
    await runPostMoveCoaching({
      coach,
      fenBefore: DEFAULT_POSITION,
      gameNodeId: node.id,
      playedMove: node.move!,
      coachUnavailable: null,
      requestId: "coach-stale",
      isCurrent: () => false,
    });
    expect(useGameStore.getState().session.mode).toBe("analyzing");
    await coach.dispose();
  });

  it("moves to opponentThinking when analysis still owns the node", async () => {
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4", { afterMode: "analyzing" });
    const node = getCurrentNode(useGameStore.getState().tree);
    expect(node.move).toBeDefined();
    const coach = createCoachingController({
      createEngine: () => createStubAnalysisEngine({ delayMs: 10 }),
    });
    await coach.start();
    await runPostMoveCoaching({
      coach,
      fenBefore: DEFAULT_POSITION,
      gameNodeId: node.id,
      playedMove: node.move!,
      coachUnavailable: null,
      requestId: "coach-ok",
    });
    expect(useGameStore.getState().session.mode).toBe("opponentThinking");
    await coach.dispose();
  });
});

describe("requestOpponentMove", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...useGameStore.getInitialState(),
    });
  });

  it("does not enter error when a cancelled request returns null", async () => {
    useGameStore.getState().startGame();
    expect(useGameStore.getState().playMove("e2e4")).toBe(true);
    expect(useGameStore.getState().session.mode).toBe("opponentThinking");

    const maia = createStubMaiaSession({ moveDelayMs: 80 });
    await maia.start();
    const pending = requestOpponentMove({ maia, requestId: "opp-1" });
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    expect(maia.getState().phase).toBe("thinking");
    maia.cancelPending();
    await pending;

    expect(useGameStore.getState().session.mode).toBe("opponentThinking");
    expect(useGameStore.getState().lastError).toBeNull();
    await maia.dispose();
  });

  it("lets a newer opponent request proceed after cancel", async () => {
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    const maia = createStubMaiaSession({
      moveDelayMs: 30,
      scriptedMoves: ["e7e5"],
    });
    await maia.start();
    const first = requestOpponentMove({ maia, requestId: "opp-old" });
    maia.cancelPending();
    const second = requestOpponentMove({ maia, requestId: "opp-new" });
    await first;
    await second;

    expect(useGameStore.getState().session.mode).not.toBe("error");
    expect(
      getMoveHistory(
        useGameStore.getState().tree,
        useGameStore.getState().tree.currentNodeId,
      ).map((m) => m.uci),
    ).toEqual(["e2e4", "e7e5"]);
    await maia.dispose();
  });

  it("does not apply a move after the target is superseded", async () => {
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    const maia = createStubMaiaSession({ scriptedMoves: ["e7e5"] });
    await maia.start();
    let checks = 0;
    await requestOpponentMove({
      maia,
      requestId: "opp-stale-target",
      isCurrent: () => {
        checks += 1;
        return checks === 1;
      },
    });
    expect(
      getMoveHistory(
        useGameStore.getState().tree,
        useGameStore.getState().tree.currentNodeId,
      ).map((m) => m.uci),
    ).toEqual(["e2e4"]);
    expect(useGameStore.getState().session.mode).toBe("opponentThinking");
    await maia.dispose();
  });

  it("surfaces a real Maia failure as error", async () => {
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    const maia = createStubMaiaSession({ failInit: true });
    await requestOpponentMove({ maia, requestId: "opp-fail" });
    expect(useGameStore.getState().session.mode).toBe("error");
    await maia.dispose();
  });

  it("plays Maia's opening move when the human is Black", async () => {
    useGameStore.getState().startGame({ humanColor: "b" });
    const maia = createStubMaiaSession({
      scriptedMoves: ["e2e4"],
    });
    await maia.start();
    await requestOpponentMove({ maia, requestId: "opp-black-open" });
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
    expect(
      getMoveHistory(
        useGameStore.getState().tree,
        useGameStore.getState().tree.currentNodeId,
      ).map((m) => m.uci),
    ).toEqual(["e2e4"]);
    await maia.dispose();
  });
});
