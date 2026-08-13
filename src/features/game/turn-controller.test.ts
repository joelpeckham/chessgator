import { describe, expect, it } from "vitest";
import { createInitialTree } from "@/domain/game";
import {
  deriveBoardInteractivity,
  deriveOpponentTarget,
  opponentTargetKey,
} from "@/features/game/turn-controller";

describe("deriveOpponentTarget", () => {
  it("pauses live opponent work while practicing", () => {
    const tree = createInitialTree();
    expect(
      deriveOpponentTarget({
        timelineMode: "practice",
        practicePhase: "playerTurn",
        draftTree: tree,
        liveMode: "opponentThinking",
        liveTree: tree,
      }),
    ).toBeNull();
  });

  it("targets the draft while practice is waiting on Maia", () => {
    const tree = createInitialTree();
    const target = deriveOpponentTarget({
      timelineMode: "practice",
      practicePhase: "opponentThinking",
      draftTree: tree,
      liveMode: "opponentThinking",
      liveTree: tree,
    });
    expect(target).toEqual({
      scope: "practice",
      nodeId: tree.currentNodeId,
      fen: tree.nodes[tree.rootId]!.fen,
    });
    expect(opponentTargetKey(target)).toBe(`practice:${tree.currentNodeId}`);
  });

  it("targets the live tree when it is Maia's turn", () => {
    const tree = createInitialTree();
    const target = deriveOpponentTarget({
      timelineMode: "live",
      practicePhase: null,
      draftTree: null,
      liveMode: "opponentThinking",
      liveTree: tree,
    });
    expect(target?.scope).toBe("live");
  });
});

describe("deriveBoardInteractivity", () => {
  it("allows live moves only on the human's turn at the live tip", () => {
    const tree = createInitialTree();
    const fen = tree.nodes[tree.rootId]!.fen;
    expect(
      deriveBoardInteractivity({
        timelineMode: "live",
        practicePhase: null,
        draftTree: null,
        playCursorId: tree.rootId,
        liveMode: "playerTurn",
        liveFen: fen,
        humanColor: "w",
        isViewingNonLive: false,
        maiaFailed: false,
      }),
    ).toBe(true);
    expect(
      deriveBoardInteractivity({
        timelineMode: "live",
        practicePhase: null,
        draftTree: null,
        playCursorId: tree.rootId,
        liveMode: "opponentThinking",
        liveFen: fen,
        humanColor: "w",
        isViewingNonLive: false,
        maiaFailed: false,
      }),
    ).toBe(false);
  });

  it("allows practice moves only at the draft tip on the human's turn", () => {
    const tree = createInitialTree();
    expect(
      deriveBoardInteractivity({
        timelineMode: "practice",
        practicePhase: "playerTurn",
        draftTree: tree,
        playCursorId: tree.rootId,
        liveMode: "opponentThinking",
        liveFen: tree.nodes[tree.rootId]!.fen,
        humanColor: "w",
        isViewingNonLive: false,
        maiaFailed: false,
      }),
    ).toBe(true);
    expect(
      deriveBoardInteractivity({
        timelineMode: "practice",
        practicePhase: "opponentThinking",
        draftTree: tree,
        playCursorId: tree.rootId,
        liveMode: "opponentThinking",
        liveFen: tree.nodes[tree.rootId]!.fen,
        humanColor: "w",
        isViewingNonLive: false,
        maiaFailed: false,
      }),
    ).toBe(false);
  });
});
