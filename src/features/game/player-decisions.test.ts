import { describe, expect, it } from "vitest";
import {
  stepForkLane,
  transportStep,
} from "@/components/timeline/decision-graph-nav";
import type { DecisionGraphNode } from "@/components/timeline/decision-types";
import { createInitialTree, jumpToNode, playMoveOnTree } from "@/domain/game";
import type { TeachingInsight } from "@/domain/teaching";
import {
  analyzedNodeIdForFocus,
  buildDecisionGraph,
  graphHasCursor,
  lastHumanDecisionId,
  PRACTICE_BRANCH_ID,
  projectOpeningPlies,
  projectPlayerDecisions,
  suggestedAlternateUci,
} from "@/features/game/player-decisions";

const mistake: TeachingInsight = {
  concept: "missed_improvement",
  confidence: 0.8,
  explanation: "d4 is a mistake because e4 claims more of the center.",
  suggestedMoveUci: "e2e4",
  suggestedMoveSan: "e4",
  lineUci: ["e2e4"],
  refutationUci: [],
  classification: "mistake",
  quip: "There's better.",
  nudge: true,
};

function node(
  id: string,
  parentId: string | null,
  column: number,
  lane: -1 | 0 | 1,
  kind: DecisionGraphNode["kind"],
  branchId: string,
): DecisionGraphNode {
  return {
    id,
    parentId,
    column,
    lane,
    kind,
    san: id,
    moveLabel: id,
    caption: null,
    prominent: false,
    isLive: false,
    isDecision: kind === "committed",
    fen: "",
    branchId,
    decisionId: null,
  };
}

describe("projectPlayerDecisions", () => {
  it("groups a human move and Maia reply into one decision", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, d4Id, "d7d5")!.tree;

    const decisions = projectPlayerDecisions({
      tree,
      humanColor: "w",
      lessons: { [d4Id]: mistake },
    });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.san).toBe("d4");
    expect(decisions[0]?.replyNodeId).toBe(tree.currentNodeId);
    expect(decisions[0]?.prominent).toBe(true);
    expect(decisions[0]?.classification).toBe("mistake");
  });

  it("lists saved tries as siblings of the human move", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;
    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;

    const decisions = projectPlayerDecisions({
      tree,
      humanColor: "w",
      lessons: {},
    });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.san).toBe("e4");
    expect(decisions[0]?.savedTries.map((t) => t.san)).toContain("d4");
    expect(lastHumanDecisionId(tree, "w")).toBe(tree.currentNodeId);
    expect(d4Id).not.toBe(tree.currentNodeId);
  });

  it("skips Maia's opening when the human plays Black", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    tree = playMoveOnTree(tree, tree.currentNodeId, "e7e5")!.tree;

    const decisions = projectPlayerDecisions({
      tree,
      humanColor: "b",
      lessons: {},
    });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.san).toBe("e5");
    expect(projectOpeningPlies(tree, "b").map((p) => p.san)).toEqual(["e4"]);
  });

  it("shows Maia's opening before the first Black decision", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    expect(
      projectPlayerDecisions({ tree, humanColor: "b", lessons: {} }),
    ).toEqual([]);
    expect(projectOpeningPlies(tree, "b")).toHaveLength(1);
    expect(projectOpeningPlies(tree, "w")).toEqual([]);
  });
});

describe("transportStep", () => {
  it("follows the pinned branch instead of the live trunk", () => {
    const graph = {
      columns: 2,
      edges: [
        { fromId: "start", toId: "played", kind: "committed" as const },
        { fromId: "start", toId: "gator", kind: "tutor" as const },
      ],
      nodes: [
        node("start", null, 0, 0, "committed", "live"),
        node("played", "start", 1, 0, "committed", "live"),
        node("gator", "start", 1, 1, "tutor", "tutor:start"),
      ],
    };
    expect(transportStep(graph, "start", 1, "tutor:start")).toBe("gator");
    expect(transportStep(graph, "gator", -1, "tutor:start")).toBe("start");
    expect(transportStep(graph, "start", 1, "live")).toBe("played");
  });
});

describe("analyzedNodeIdForFocus", () => {
  it("returns the human move when focused on Maia's reply", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, d4Id, "d7d5")!.tree;

    expect(
      analyzedNodeIdForFocus({
        tree,
        focusNodeId: tree.currentNodeId,
        tutorRootId: null,
        humanColor: "w",
      }),
    ).toBe(d4Id);
  });

  it("returns null at the start node so Gator does not keep an older lesson", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;

    expect(
      analyzedNodeIdForFocus({
        tree,
        focusNodeId: tree.rootId,
        tutorRootId: null,
        humanColor: "w",
      }),
    ).toBeNull();
  });
});

describe("suggestedAlternateUci", () => {
  it("returns a different coach suggestion at the origin", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;
    expect(
      suggestedAlternateUci({
        tree,
        originId: tree.rootId,
        humanColor: "w",
        lessons: { [d4Id]: mistake },
      }),
    ).toBe("e2e4");
  });

  it("ignores a suggestion that matches the live human ply", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    expect(
      suggestedAlternateUci({
        tree,
        originId: tree.rootId,
        humanColor: "w",
        lessons: {
          [e4Id]: {
            ...mistake,
            suggestedMoveUci: "e2e4",
            suggestedMoveSan: "e4",
          },
        },
      }),
    ).toBeNull();
  });
});

describe("buildDecisionGraph", () => {
  it("lays out the live path as a trunk of ply columns", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4Id, "e7e5")!.tree;

    const decisions = projectPlayerDecisions({
      tree,
      humanColor: "w",
      lessons: {},
    });
    const graph = buildDecisionGraph({
      tree,
      startNodeId: tree.rootId,
      tipNodeId: tree.currentNodeId,
      openingPlies: [],
      decisions,
      focusedDecision: null,
      lessonFork: null,
      engineHint: null,
    });
    const trunk = graph.nodes.filter((n) => n.lane === 0);
    expect(trunk.map((n) => n.san)).toEqual(["", "e4", "e5"]);
    expect(trunk.every((n) => n.kind === "committed")).toBe(true);
    expect(graph.nodes.some((n) => n.lane !== 0)).toBe(false);
  });

  it("forks Gator and saved tries only at the focused decision", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;
    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4Id, "e7e5")!.tree;

    const decisions = projectPlayerDecisions({
      tree,
      humanColor: "w",
      lessons: { [e4Id]: mistake },
    });
    const focused = decisions[0]!;
    const graph = buildDecisionGraph({
      tree,
      startNodeId: tree.rootId,
      tipNodeId: tree.currentNodeId,
      openingPlies: [],
      decisions,
      focusedDecision: focused,
      lessonFork: {
        originNodeId: tree.rootId,
        played: {
          id: e4Id,
          label: "1.e4",
          san: "e4",
          fen: "",
        },
        suggested: {
          head: {
            id: "tutor:root:c2c4",
            label: "1.c4",
            san: "c4",
            fen: "",
          },
          plies: [{ id: "tutor:root:c2c4", label: "1.c4", san: "c4", fen: "" }],
        },
      },
      engineHint: null,
    });
    const tutor = graph.nodes.find((n) => n.kind === "tutor");
    const tries = graph.nodes.filter((n) => n.kind === "variation");
    expect(tutor?.lane).toBe(1);
    expect(tutor?.san).toBe("c4");
    expect(tries.find((n) => n.lane === -1)?.san).toBe("d4");
    expect(tries.map((n) => n.san)).toContain("d4");
    expect(d4Id).not.toBe(e4Id);
  });

  it("collapses extra saved tries into an overflow hub", () => {
    let tree = createInitialTree();
    for (const uci of ["d2d4", "c2c4", "g1f3"]) {
      tree = jumpToNode(tree, tree.rootId)!;
      tree = playMoveOnTree(tree, tree.rootId, uci)!.tree;
    }
    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;

    const decisions = projectPlayerDecisions({
      tree,
      humanColor: "w",
      lessons: {},
    });
    const graph = buildDecisionGraph({
      tree,
      startNodeId: tree.rootId,
      tipNodeId: e4Id,
      openingPlies: [],
      decisions,
      focusedDecision: decisions[0]!,
      lessonFork: null,
      engineHint: null,
    });
    const overflow = graph.nodes.find((n) => n.kind === "overflow");
    expect(overflow?.overflowCount).toBe(1);
    expect(graph.nodes.filter((n) => n.kind === "variation")).toHaveLength(2);
    expect(overflow).toBeDefined();
    if (!overflow) return;
    expect(graphHasCursor(graph, overflow.id)).toBe(false);
    expect(graphHasCursor(graph, e4Id)).toBe(true);
  });

  it("keeps a selected saved try in the graph", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;
    tree = jumpToNode(tree, tree.rootId)!;
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;

    const decisions = projectPlayerDecisions({
      tree,
      humanColor: "w",
      lessons: {},
    });
    const graph = buildDecisionGraph({
      tree,
      startNodeId: tree.rootId,
      tipNodeId: tree.currentNodeId,
      openingPlies: [],
      decisions,
      focusedDecision: decisions[0]!,
      lessonFork: null,
      engineHint: null,
      cursorId: d4Id,
      pinnedBranchId: `try:${d4Id}`,
    });
    expect(graphHasCursor(graph, d4Id)).toBe(true);
  });

  it("overlays the practice line on the live trunk", () => {
    let live = createInitialTree();
    live = playMoveOnTree(live, live.rootId, "d2d4")!.tree;
    let draft = jumpToNode(live, live.rootId)!;
    draft = playMoveOnTree(draft, draft.rootId, "e2e4", {
      asVariation: true,
    })!.tree;
    const practiceId = draft.currentNodeId;

    const decisions = projectPlayerDecisions({
      tree: live,
      humanColor: "w",
      lessons: {},
    });
    const graph = buildDecisionGraph({
      tree: live,
      startNodeId: live.rootId,
      tipNodeId: live.currentNodeId,
      openingPlies: [],
      decisions,
      focusedDecision: decisions[0]!,
      lessonFork: null,
      engineHint: null,
      cursorId: practiceId,
      pinnedBranchId: PRACTICE_BRANCH_ID,
      practice: {
        originId: live.rootId,
        draftTree: draft,
        currentId: practiceId,
      },
    });
    expect(
      graph.nodes.some((n) => n.kind === "committed" && n.san === "d4"),
    ).toBe(true);
    expect(
      graph.nodes.some((n) => n.kind === "practice" && n.san === "e4"),
    ).toBe(true);
    expect(graphHasCursor(graph, practiceId)).toBe(true);
  });
});

describe("stepForkLane", () => {
  it("moves up and down among nodes in the same column", () => {
    const graph = {
      columns: 1,
      edges: [],
      nodes: [
        node("gator", "start", 1, 1, "tutor", "tutor:start"),
        {
          ...node("played", "start", 1, 0, "committed", "live"),
          isLive: true,
          isDecision: true,
        },
        node("try", "start", 1, -1, "variation", "try:try"),
        node("more", "start", 1, -1, "overflow", "overflow"),
      ],
    };
    expect(stepForkLane(graph, "played", 1)).toBe("gator");
    expect(stepForkLane(graph, "played", -1)).toBe("try");
    expect(stepForkLane(graph, "gator", 1)).toBeNull();
    expect(stepForkLane(graph, "try", -1)).toBeNull();
  });
});
