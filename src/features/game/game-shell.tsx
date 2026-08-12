"use client";

import { RiSettings3Line } from "@remixicon/react";
import { useState } from "react";
import { styleBoardAnnotations } from "@/components/board/annotation-style";
import { BoardPreviewVeil } from "@/components/board/board-preview-veil";
import { ChessboardAdapter } from "@/components/board/chessboard-adapter";
import { lastMoveSquares } from "@/components/board/move-utils";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { CoachRail } from "@/components/coach/coach-rail";
import { FeedbackStack } from "@/components/coach/feedback-stack";
import { PromotionDialog } from "@/components/game/promotion-dialog";
import { SettingsSheet } from "@/components/game/settings-sheet";
import {
  buildBranchGraph,
  isVirtualTimelineId,
  resolveReviewFen,
} from "@/components/timeline/branch-graph";
import { MoveTimeline } from "@/components/timeline/move-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  findKingSquare,
  getCurrentNode,
  getMoveHistory,
  getNode,
  getStatusAtNode,
  getTurn,
  HUMAN_COLOR,
  isHumanTurn,
  type PieceSymbol,
} from "@/domain/game";
import { buildTutorLine } from "@/features/game/game-flow";
import { useGameStore } from "@/features/game/game-store";
import { buildFeedbackNotices } from "@/features/game/notices";
import { getStatusPresentation } from "@/features/game/status-copy";
import { useBoardViewport } from "@/features/game/use-board-viewport";
import { useGameFlow } from "@/features/game/use-game-flow";
import {
  type GameRuntimeOptions,
  useGameRuntime,
} from "@/features/game/use-game-runtime";
import { useLiveAnnouncements } from "@/features/game/use-live-announcements";

/**
 * Client-only game composition. All workers, Zustand, and browser APIs stay here
 * (or below) so `page.tsx` can remain a static Server Component shell.
 */
export function GameShell(props: GameRuntimeOptions = {}) {
  const tree = useGameStore((s) => s.tree);
  const session = useGameStore((s) => s.session);
  const preferences = useGameStore((s) => s.preferences);
  const hydrated = useGameStore((s) => s.hydrated);
  const resumed = useGameStore((s) => s.resumed);
  const lastError = useGameStore((s) => s.lastError);
  const setMaiaElo = useGameStore((s) => s.setMaiaElo);

  const runtime = useGameRuntime(props);
  const { boardSize, compact } = useBoardViewport();

  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewNodeId, setReviewNodeId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [coachExpanded, setCoachExpanded] = useState(false);
  const [coachUserCollapsedAuto, setCoachUserCollapsedAuto] = useState(false);
  const [expandedOverflowKeys, setExpandedOverflowKeys] = useState<string[]>(
    [],
  );
  const [navMessage, setNavMessage] = useState<string | null>(null);
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(
    () => new Set(),
  );

  const liveFen = getCurrentNode(tree).fen;
  const currentStatus = getStatusAtNode(tree, tree.currentNodeId);
  const moves = getMoveHistory(tree, tree.currentNodeId);
  const lastMove = moves[moves.length - 1] ?? null;
  const mode = session.mode;
  const isReviewing =
    reviewNodeId != null && reviewNodeId !== tree.currentNodeId;
  const viewedNodeId = previewNodeId ?? reviewNodeId;
  const isViewingNonLive =
    viewedNodeId != null && viewedNodeId !== tree.currentNodeId;

  const tutorLine = buildTutorLine(
    tree,
    runtime.coaching.insight,
    runtime.coaching.evidence,
  );
  const liveTurn = getTurn(liveFen);
  const futureLine =
    isHumanTurn(liveTurn) &&
    !isReviewing &&
    runtime.coaching.futureNodeId === tree.currentNodeId
      ? runtime.coaching.futureLine
      : null;

  const graph = buildBranchGraph({
    tree,
    reviewNodeId,
    futureLine,
    tutorLine,
    expandedOverflowKeys,
    maxLaneSide: compact ? 1 : 2,
    showEngineLine: compact ? !tutorLine : isHumanTurn(liveTurn),
    showCoachLine: Boolean(tutorLine),
  });

  const boardFen = resolveReviewFen(tree, graph, viewedNodeId);
  const boardStatus =
    viewedNodeId && !isVirtualTimelineId(viewedNodeId)
      ? getStatusAtNode(tree, viewedNodeId)
      : getStatusAtNode(tree, tree.currentNodeId);

  const interactive =
    mode === "playerTurn" &&
    isHumanTurn(getTurn(liveFen)) &&
    !isViewingNonLive &&
    runtime.maia.phase !== "failed";

  const checkSquare =
    boardStatus.isCheck && !boardStatus.isGameOver
      ? findKingSquare(boardFen, boardStatus.turn)
      : null;

  const analyzing =
    runtime.coaching.phase === "analyzing" || mode === "analyzing";
  const visibleInsight = runtime.coaching.insightDismissed
    ? null
    : runtime.coaching.insight;
  const shouldAutoExpand =
    Boolean(visibleInsight?.autoExpand) && !coachUserCollapsedAuto;
  const coachExpandedEffective =
    coachExpanded || (shouldAutoExpand && Boolean(visibleInsight));

  const showCoachAnnotations =
    !isViewingNonLive &&
    !runtime.coachUnavailable &&
    (coachExpandedEffective ||
      Boolean(visibleInsight?.autoExpand) ||
      Boolean(runtime.coaching.hint));

  const announcements = useLiveAnnouncements({
    visibleInsight,
    evidenceGameNodeId: runtime.coaching.evidence?.gameNodeId,
    hint: runtime.coaching.hint,
    navMessage,
    onNavMessageExpire: () => setNavMessage(null),
  });

  const flow = useGameFlow({
    maiaSession: runtime.maiaSession,
    coach: runtime.coach,
    coachUnavailable: runtime.coachUnavailable,
    interactive,
    tree,
    graph,
    setNavMessage,
    setReviewNodeId,
    setPreviewNodeId,
    setCoachExpanded,
    setCoachUserCollapsedAuto,
    setPromotion,
    setExpandedOverflowKeys,
    retryEngines: runtime.retryEngines,
  });

  const statusPresentation = getStatusPresentation({
    mode: isReviewing ? "reviewing" : mode,
    status: currentStatus,
    terminalReason: session.terminalReason,
    maia: runtime.maia,
    lastError,
    coachUnavailable: runtime.coachUnavailable,
    coachMessage: runtime.coaching.message,
    lastMove,
    navigationMessage: navMessage,
    coachAnnouncement: announcements.coachAnnouncement,
    hintAnnouncement: announcements.hintAnnouncement,
    enginesWarming: runtime.enginesWarming,
  });

  const canResign =
    mode === "playerTurn" ||
    mode === "opponentThinking" ||
    mode === "analyzing" ||
    mode === "reviewing";
  const canUndoMyMove =
    moves.some((m) => m.color === HUMAN_COLOR) &&
    (mode === "playerTurn" ||
      mode === "analyzing" ||
      mode === "reviewing" ||
      mode === "opponentThinking" ||
      mode === "gameOver");

  const boardMarks =
    isViewingNonLive || !showCoachAnnotations
      ? styleBoardAnnotations({
          highlightSquares: [],
          arrows: [],
          labels: [],
        })
      : styleBoardAnnotations(runtime.coaching.annotations);

  const viewedGraphNode = graph.nodes.find(
    (n) => n.id === (viewedNodeId ?? tree.currentNodeId),
  );
  const viewedTreeNode = getNode(tree, viewedNodeId ?? tree.currentNodeId);
  const boardLastMove = lastMoveSquares(
    viewedGraphNode?.uciFromParent ?? viewedTreeNode?.move?.uci ?? null,
  );

  const notices = buildFeedbackNotices({
    engineNoticeArmed: runtime.engineNoticeArmed,
    enginesWarming: runtime.enginesWarming,
    dismissedIds: dismissedNotices,
    maiaPhase: runtime.maia.phase,
    maiaMessage: runtime.maia.message,
    mode,
    errorHeadline: statusPresentation.headline,
    errorDetail: statusPresentation.detail,
    navMessage,
  });

  return (
    <TooltipProvider>
      <div
        className="game-shell relative flex h-dvh max-h-dvh flex-1 flex-col overflow-hidden bg-background"
        data-testid="game-shell"
        data-hydrated={hydrated ? "true" : "false"}
        data-resumed={resumed ? "true" : "false"}
        data-board-size={boardSize}
      >
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="live-region"
        >
          {statusPresentation.announcement}
        </div>

        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <ChessgatorWordmark />
            <Badge
              variant={statusPresentation.badgeVariant}
              data-testid="status-badge"
              data-mode={isReviewing ? "reviewing" : mode}
              data-opponent-phase={runtime.maia.phase}
            >
              {statusPresentation.badgeLabel}
            </Badge>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Open settings"
            data-testid="settings-button"
            onClick={() => setSettingsOpen(true)}
          >
            <RiSettings3Line />
          </Button>
        </header>

        <main className="relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-2">
          <div
            className="relative shrink-0"
            style={{
              width: boardSize,
              height: boardSize,
            }}
            data-testid="board-frame"
          >
            <ChessboardAdapter
              fen={boardFen}
              interactive={interactive}
              lastMove={boardLastMove}
              isCheck={boardStatus.isCheck && !boardStatus.isGameOver}
              checkSquare={checkSquare}
              highlightSquares={boardMarks.highlightSquares}
              ghostSquares={[]}
              squareLabels={boardMarks.labels}
              arrows={boardMarks.arrows}
              onMove={flow.applyPlayerMove}
              onPromotionNeeded={(from, to) => setPromotion({ from, to })}
              className="h-full w-full"
            />
            <BoardPreviewVeil active={isViewingNonLive} />
          </div>

          <FeedbackStack
            notices={notices}
            onDismissNotice={(id) => {
              setDismissedNotices((prev) => new Set(prev).add(id));
              if (id === "nav") setNavMessage(null);
            }}
          />
        </main>

        <footer
          className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80"
          data-testid="timeline-bar"
        >
          <CoachRail
            expanded={coachExpandedEffective}
            onExpandedChange={(next) => {
              if (!next && shouldAutoExpand) {
                setCoachUserCollapsedAuto(true);
              }
              setCoachExpanded(next);
              if (next) {
                runtime.coach.showInsight(tree.currentNodeId);
              }
            }}
            insight={visibleInsight}
            analyzing={analyzing}
            canTakebackRetry={canUndoMyMove}
            onTakebackRetry={flow.handleUndoMyMove}
            onTrySuggested={
              visibleInsight?.suggestedMoveUci && !runtime.coachUnavailable
                ? flow.handleTrySuggested
                : undefined
            }
            onDismiss={() => {
              runtime.coach.dismissInsight();
              setCoachExpanded(false);
              announcements.announce("Coach feedback dismissed.");
            }}
            hint={runtime.coaching.hint}
            hintDisabled={!interactive || Boolean(runtime.coachUnavailable)}
            hintFen={liveFen}
            showTutorLaneHint={Boolean(tutorLine)}
            canExpand={
              Boolean(visibleInsight) ||
              Boolean(runtime.coaching.hint) ||
              analyzing ||
              runtime.coach.getCachedInsight(tree.currentNodeId) != null
            }
            onRequestHint={() => {
              if (runtime.coachUnavailable) return;
              setCoachExpanded(true);
              runtime.coach.showInsight();
              void runtime.coach.escalateHint({
                fen: liveFen,
                gameNodeId: tree.currentNodeId,
                sideToMove: HUMAN_COLOR,
              });
            }}
          />
          <MoveTimeline
            tree={tree}
            graph={graph}
            reviewNodeId={reviewNodeId}
            previewNodeId={previewNodeId}
            disabled={mode === "error"}
            compact={compact}
            expandedOverflowKeys={expandedOverflowKeys}
            onExpandedOverflowChange={(keys) =>
              setExpandedOverflowKeys([...keys])
            }
            onSelectNode={flow.handleSelectTimelineNode}
            onPreviewNode={setPreviewNodeId}
            onReturnLive={flow.handleReturnLive}
            onOpenCoach={() => {
              runtime.coach.showInsight(tree.currentNodeId);
              setCoachExpanded(true);
            }}
            className="rounded-none border-0 bg-transparent shadow-none ring-0"
          />
        </footer>

        <SettingsSheet
          open={settingsOpen}
          onOpenChange={(open) => {
            setSettingsOpen(open);
            if (open) setCoachExpanded(false);
          }}
          maiaElo={preferences.maiaElo}
          onMaiaEloChange={setMaiaElo}
          fen={liveFen}
          canPlayMove={interactive}
          onSelectMove={(move) => {
            flow.applyPlayerMove(move);
          }}
          engine={{
            message:
              runtime.maia.phase === "failed"
                ? runtime.maia.message
                : runtime.enginesWarming
                  ? (runtime.maia.message ?? "Starting engines…")
                  : "Maia ready",
            starting: runtime.enginesWarming && runtime.maia.phase !== "failed",
            failed: runtime.maia.phase === "failed" || mode === "error",
            coachMessage:
              runtime.coachUnavailable ??
              (runtime.coaching.phase === "failed"
                ? runtime.coaching.message
                : null),
            onRetry: () => {
              void flow.handleRetryEngines();
            },
          }}
          canResign={canResign}
          canRestart
          onResign={flow.handleResign}
          onRestart={flow.handleRestart}
        />

        <PromotionDialog
          open={promotion != null}
          from={promotion?.from ?? ""}
          to={promotion?.to ?? ""}
          onCancel={() => setPromotion(null)}
          onChoose={(piece: PieceSymbol) => {
            if (!promotion) return;
            flow.applyPlayerMove({
              from: promotion.from,
              to: promotion.to,
              promotion: piece,
            });
          }}
        />
      </div>
    </TooltipProvider>
  );
}
