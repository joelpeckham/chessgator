import { beforeEach, describe, expect, it } from "vitest";
import type { MoveAnalysisEvidence } from "@/domain/analysis";
import {
  createInitialTree,
  createVariationExplorer,
  DEFAULT_POSITION,
  getCurrentNode,
  getMoveHistory,
  getNode,
  playMoveOnTree,
  stepVariationForward,
} from "@/domain/game";
import type { GameTree } from "@/domain/game/types";
import type { TeachingInsight } from "@/domain/teaching";
import { createCoachingController } from "@/features/game/coaching-controller";
import {
  buildTutorLine,
  commitPracticeMove,
  commitTryInstead,
  firstHumanUciFromDraft,
  requestOpponentMove,
  runPostMoveCoaching,
  trySuggestedMove,
  undoHumanMove,
} from "@/features/game/game-flow";
import { useGameStore } from "@/features/game/game-store";
import { createStubAnalysisEngine } from "@/features/game/stub-analysis";
import { createStubMaiaSession } from "@/features/game/stub-maia";

function play(tree: GameTree, uci: string): GameTree {
  const result = playMoveOnTree(tree, tree.currentNodeId, uci);
  if (!result) throw new Error(`Illegal move ${uci}`);
  return result.tree;
}

describe("commitTryInstead", () => {
  it("commits the suggested ply and prunes ghost siblings under the origin", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    tree = play(tree, "e7e5");
    const originId = tree.currentNodeId;
    tree = play(tree, "a2a4");

    const started = createVariationExplorer(tree, originId, ["g1f3", "b8c6"]);
    expect(started).not.toBeNull();
    tree = started!.tree;
    const stepped = stepVariationForward(tree, started!.explorer);
    expect(stepped).not.toBeNull();
    tree = stepped!.tree;

    const committed = commitTryInstead({
      tree,
      originNodeId: originId,
      lineUci: ["g1f3", "b8c6"],
      suggestedMoveUci: "g1f3",
    });
    expect(committed).not.toBeNull();
    expect(committed!.node.move?.uci).toBe("g1f3");
    expect(committed!.node.isVariation).toBe(false);
    expect(committed!.tree.currentNodeId).toBe(committed!.node.id);

    const origin = getNode(committed!.tree, originId);
    expect(origin?.childIds).toContain(committed!.node.id);
    const ghosts = origin?.childIds.filter(
      (id) => committed!.tree.nodes[id]?.isVariation,
    );
    expect(ghosts).toEqual([]);
  });

  it("still commits when the coach line is empty by using the suggested move", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    tree = play(tree, "e7e5");
    const originId = tree.currentNodeId;
    tree = play(tree, "a2a4");

    const committed = commitTryInstead({
      tree,
      originNodeId: originId,
      lineUci: [],
      suggestedMoveUci: "g1f3",
    });
    expect(committed).not.toBeNull();
    expect(committed!.node.move?.uci).toBe("g1f3");
  });
});

describe("trySuggestedMove", () => {
  it("commits the suggested ply and reports opponent-to-move", () => {
    let tree = createInitialTree();
    tree = play(tree, "e2e4");
    tree = play(tree, "e7e5");
    tree = play(tree, "a2a4");
    const playedNode = getNode(tree, tree.currentNodeId);
    expect(playedNode?.move).toBeDefined();
    if (!playedNode?.move) return;

    const result = trySuggestedMove({
      tree,
      insight: {
        concept: "missed_improvement",
        confidence: 0.8,
        explanation: "Develop the knight.",
        suggestedMoveUci: "g1f3",
        suggestedMoveSan: "Nf3",
        lineUci: ["g1f3", "b8c6"],
        refutationUci: [],
        classification: "inaccuracy",
        quip: "There's better.",
        nudge: false,
      } satisfies TeachingInsight,
      evidence: {
        gameNodeId: tree.currentNodeId,
        playedMove: playedNode.move,
      } as MoveAnalysisEvidence,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needsOpponent).toBe(true);
    expect(result.mode).toBe("opponentThinking");
    expect(result.tree.nodes[result.tree.currentNodeId]?.move?.uci).toBe(
      "g1f3",
    );
  });

  it("reports opponent-to-move after a Black try-instead", () => {
    useGameStore.setState({
      ...useGameStore.getInitialState(),
    });
    useGameStore.getState().startGame({ humanColor: "b" });
    let tree = useGameStore.getState().tree;
    tree = play(tree, "e2e4");
    tree = play(tree, "e7e5");
    const playedNode = getNode(tree, tree.currentNodeId);
    expect(playedNode?.move).toBeDefined();
    if (!playedNode?.move) return;

    useGameStore.setState({ tree, humanColor: "b" });
    const result = trySuggestedMove({
      tree,
      insight: {
        concept: "missed_improvement",
        confidence: 0.8,
        explanation: "Strike the center.",
        suggestedMoveUci: "d7d5",
        suggestedMoveSan: "d5",
        lineUci: ["d7d5", "e4d5"],
        refutationUci: [],
        classification: "inaccuracy",
        quip: "There's better.",
        nudge: false,
      } satisfies TeachingInsight,
      evidence: {
        gameNodeId: tree.currentNodeId,
        playedMove: playedNode.move,
      } as MoveAnalysisEvidence,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needsOpponent).toBe(true);
    expect(result.mode).toBe("opponentThinking");
    expect(result.tree.nodes[result.tree.currentNodeId]?.move?.uci).toBe(
      "d7d5",
    );
  });
});

describe("commitPracticeMove", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...useGameStore.getInitialState(),
    });
  });

  it("commits the first draft ply and keeps the abandoned live line", () => {
    useGameStore.getState().startGame();
    let tree = useGameStore.getState().tree;
    tree = play(tree, "d2d4");
    const d4Id = tree.currentNodeId;
    tree = play(tree, "d7d5");
    useGameStore.setState({ tree });

    const result = commitPracticeMove({
      liveTree: tree,
      originNodeId: tree.rootId,
      commitUci: "e2e4",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needsOpponent).toBe(true);
    expect(result.tree.nodes[result.tree.currentNodeId]?.move?.uci).toBe(
      "e2e4",
    );
    const origin = getNode(result.tree, result.tree.rootId);
    expect(origin?.childIds).toContain(d4Id);
    expect(origin?.childIds[0]).toBe(result.tree.currentNodeId);
    expect(result.tree.nodes[d4Id]?.move?.uci).toBe("d2d4");
  });

  it("promotes only the first practiced human ply from a longer draft", () => {
    let draft = createInitialTree();
    draft = play(draft, "e2e4");
    draft = play(draft, "e7e5");
    draft = play(draft, "d2d4");
    expect(
      firstHumanUciFromDraft({
        draft,
        originId: draft.rootId,
        humanColor: "w",
      }),
    ).toBe("e2e4");
  });
});

describe("buildTutorLine", () => {
  it("projects from the analyzed human node's parent, not a tutor origin", () => {
    let tree = createInitialTree();
    tree = play(tree, "d2d4");
    const analyzedId = tree.currentNodeId;
    tree = play(tree, "d7d5");

    const line = buildTutorLine(
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
        quip: "There's better.",
        nudge: true,
      },
      analyzedId,
    );
    expect(line).not.toBeNull();
    expect(line!.rootNodeId).toBe(tree.rootId);
    expect(line!.kind).toBe("tutor");
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

describe("undoHumanMove", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...useGameStore.getInitialState(),
    });
  });

  it("takes back the human ply and the opponent reply", () => {
    useGameStore.getState().startGame();
    useGameStore.getState().playMove("e2e4");
    useGameStore.getState().playMove("e7e5");
    undoHumanMove();
    expect(
      getMoveHistory(
        useGameStore.getState().tree,
        useGameStore.getState().tree.currentNodeId,
      ),
    ).toEqual([]);
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
  });

  it("does not take back Maia's opening when the human has not moved", () => {
    useGameStore.getState().startGame({ humanColor: "b" });
    useGameStore.getState().playMove("e2e4");
    undoHumanMove();
    expect(
      getMoveHistory(
        useGameStore.getState().tree,
        useGameStore.getState().tree.currentNodeId,
      ).map((m) => m.uci),
    ).toEqual(["e2e4"]);
  });

  it("takes back only the Black human ply when it is last", () => {
    useGameStore.getState().startGame({ humanColor: "b" });
    useGameStore.getState().playMove("e2e4");
    useGameStore.getState().playMove("e7e5");
    undoHumanMove();
    expect(
      getMoveHistory(
        useGameStore.getState().tree,
        useGameStore.getState().tree.currentNodeId,
      ).map((m) => m.uci),
    ).toEqual(["e2e4"]);
    expect(useGameStore.getState().session.mode).toBe("playerTurn");
  });
});
