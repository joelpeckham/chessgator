import { beforeEach, describe, expect, it } from "vitest";
import {
  createInitialTree,
  jumpToNode,
  playMoveOnTree,
} from "@/domain/game/tree";
import { useGameStore } from "@/features/game/game-store";
import {
  handOffHeroGame,
  playableLeafId,
} from "@/features/landing/hero-handoff";

describe("playableLeafId", () => {
  it("stays on a leaf", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    expect(playableLeafId(tree)).toBe(tree.currentNodeId);
  });

  it("walks forward from a review pointer to the live leaf", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4 = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4, "e7e5")!.tree;
    const e5 = tree.currentNodeId;
    tree = jumpToNode(tree, e4)!;
    expect(tree.currentNodeId).toBe(e4);
    expect(playableLeafId(tree)).toBe(e5);
  });
});

describe("handOffHeroGame", () => {
  beforeEach(() => {
    useGameStore.setState({ ...useGameStore.getInitialState() });
  });

  it("leaves the store untouched when the visitor never played", () => {
    handOffHeroGame(false);
    const state = useGameStore.getState();
    expect(state.hydrated).toBe(false);
    expect(state.urlPresetApplied).toBe(false);
    expect(state.session.mode).toBe("loading");
  });

  it("finalizes the hero game after a move so /game trusts it", () => {
    useGameStore.getState().startGame({ humanColor: "w" });
    useGameStore.getState().playMove("e2e4", { afterMode: "analyzing" });
    handOffHeroGame(true);
    const state = useGameStore.getState();
    expect(state.urlPresetApplied).toBe(true);
    expect(state.session.mode).toBe("opponentThinking");
  });
});
