import { describe, expect, it } from "vitest";
import { createInitialTree, playMoveOnTree } from "@/domain/game";
import {
  graphCursorId,
  INITIAL_TIMELINE_SESSION,
  isReviewingNonLive,
  practiceDraft,
  reduceTimelineSession,
  viewedNodeId,
} from "@/features/game/timeline-session";

describe("reduceTimelineSession", () => {
  it("selects a past node as review without mutating live", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "e2e4")!.tree;
    const e4Id = tree.currentNodeId;
    tree = playMoveOnTree(tree, e4Id, "e7e5")!.tree;

    const reviewed = reduceTimelineSession(INITIAL_TIMELINE_SESSION, {
      type: "selectNode",
      nodeId: e4Id,
      liveId: tree.currentNodeId,
    });
    expect(reviewed.mode).toBe("review");
    expect(reviewed.focusNodeId).toBe(e4Id);
    expect(isReviewingNonLive(reviewed, tree.currentNodeId)).toBe(true);
    expect(viewedNodeId(reviewed, tree.currentNodeId)).toBe(e4Id);
  });

  it("keeps the graph cursor on the practice line while previewing a side node", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;

    let session = reduceTimelineSession(INITIAL_TIMELINE_SESSION, {
      type: "startPractice",
      originId: tree.rootId,
      liveTree: tree,
      humanColor: "w",
    });
    session = reduceTimelineSession(session, {
      type: "practiceMove",
      input: "e2e4",
      humanColor: "w",
    });
    const practiceId = practiceDraft(session)!.tree.currentNodeId;
    session = reduceTimelineSession(session, {
      type: "preview",
      nodeId: d4Id,
    });

    expect(viewedNodeId(session, tree.rootId)).toBe(d4Id);
    expect(graphCursorId(session, tree.rootId)).toBe(practiceId);
    expect(graphCursorId(session, tree.rootId)).not.toBe(d4Id);
  });

  it("stays in practice when selecting a live node without jumping the draft", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const d4Id = tree.currentNodeId;

    let session = reduceTimelineSession(INITIAL_TIMELINE_SESSION, {
      type: "startPractice",
      originId: tree.rootId,
      liveTree: tree,
      humanColor: "w",
    });
    session = reduceTimelineSession(session, {
      type: "practiceMove",
      input: "e2e4",
      humanColor: "w",
    });
    const practiceId = practiceDraft(session)!.tree.currentNodeId;
    session = reduceTimelineSession(session, {
      type: "selectNode",
      nodeId: d4Id,
      liveId: d4Id,
      pinnedBranchId: "live",
    });
    expect(session.mode).toBe("practice");
    expect(session.focusNodeId).toBe(d4Id);
    expect(practiceDraft(session)?.tree.currentNodeId).toBe(practiceId);
  });

  it("returns to live from review", () => {
    const reviewed = reduceTimelineSession(INITIAL_TIMELINE_SESSION, {
      type: "selectNode",
      nodeId: "n1",
      liveId: "live",
    });
    const live = reduceTimelineSession(reviewed, { type: "returnLive" });
    expect(live).toEqual(INITIAL_TIMELINE_SESSION);
  });

  it("practices on an isolated draft and undoes a complete turn", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    const liveId = tree.currentNodeId;

    let session = reduceTimelineSession(INITIAL_TIMELINE_SESSION, {
      type: "startPractice",
      originId: tree.rootId,
      liveTree: tree,
      humanColor: "w",
    });
    expect(session.mode).toBe("practice");
    expect(practiceDraft(session)?.phase).toBe("playerTurn");
    expect(practiceDraft(session)?.tree.currentNodeId).toBe(tree.rootId);

    session = reduceTimelineSession(session, {
      type: "practiceMove",
      input: "e2e4",
      humanColor: "w",
    });
    const afterHuman = practiceDraft(session)!.tree;
    expect(afterHuman.nodes[afterHuman.currentNodeId]?.move?.uci).toBe("e2e4");
    expect(practiceDraft(session)?.phase).toBe("opponentThinking");
    expect(tree.currentNodeId).toBe(liveId);

    session = reduceTimelineSession(session, {
      type: "practiceOpponentMove",
      input: "e7e5",
    });
    expect(practiceDraft(session)?.phase).toBe("playerTurn");
    expect(practiceDraft(session)?.turns).toEqual([
      { humanUci: "e2e4", replyUci: "e7e5" },
    ]);

    session = reduceTimelineSession(session, { type: "practiceUndo" });
    expect(practiceDraft(session)?.tree.currentNodeId).toBe(tree.rootId);
    expect(practiceDraft(session)?.redo).toEqual([
      { humanUci: "e2e4", replyUci: "e7e5" },
    ]);

    session = reduceTimelineSession(session, {
      type: "practiceRedo",
      humanColor: "w",
    });
    const afterRedo = practiceDraft(session)!.tree;
    expect(afterRedo.nodes[afterRedo.currentNodeId]?.move?.uci).toBe("e7e5");

    session = reduceTimelineSession(session, { type: "cancelPractice" });
    expect(session.mode).toBe("live");
    expect(practiceDraft(session)).toBeNull();
    expect(tree.currentNodeId).toBe(liveId);
  });

  it("takebacks an incomplete practice ply without creating redo", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    let session = reduceTimelineSession(INITIAL_TIMELINE_SESSION, {
      type: "startPractice",
      originId: tree.rootId,
      liveTree: tree,
      humanColor: "w",
    });
    session = reduceTimelineSession(session, {
      type: "practiceMove",
      input: "e2e4",
      humanColor: "w",
    });
    expect(practiceDraft(session)?.phase).toBe("opponentThinking");
    session = reduceTimelineSession(session, { type: "practiceUndo" });
    expect(practiceDraft(session)?.tree.currentNodeId).toBe(tree.rootId);
    expect(practiceDraft(session)?.phase).toBe("playerTurn");
    expect(practiceDraft(session)?.turns).toEqual([]);
    expect(practiceDraft(session)?.redo).toEqual([]);
  });

  it("rejects opponent-side moves on the practice board", () => {
    let tree = createInitialTree();
    tree = playMoveOnTree(tree, tree.rootId, "d2d4")!.tree;
    let session = reduceTimelineSession(INITIAL_TIMELINE_SESSION, {
      type: "startPractice",
      originId: tree.rootId,
      liveTree: tree,
      humanColor: "w",
    });
    session = reduceTimelineSession(session, {
      type: "practiceMove",
      input: "e2e4",
      humanColor: "w",
    });
    const afterHuman = practiceDraft(session)!.tree.currentNodeId;
    session = reduceTimelineSession(session, {
      type: "practiceMove",
      input: "e7e5",
      humanColor: "w",
    });
    expect(practiceDraft(session)?.tree.currentNodeId).toBe(afterHuman);
  });
});
