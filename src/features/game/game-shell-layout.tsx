"use client";

import { RiSettings3Line } from "@remixicon/react";
import { BoardPreviewVeil } from "@/components/board/board-preview-veil";
import { ChessboardAdapter } from "@/components/board/chessboard-adapter";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { CoachMascot } from "@/components/coach/coach-mascot";
import { FeedbackStack } from "@/components/coach/feedback-stack";
import {
  COACH_COLUMN_WIDTH_PX,
  MASCOT_PEEK_HEIGHT_PX,
} from "@/components/coach/gator-layout";
import { GameOverCard } from "@/components/game/game-over-card";
import { PromotionDialog } from "@/components/game/promotion-dialog";
import { SettingsSheet } from "@/components/game/settings-sheet";
import { ShellFrame } from "@/components/game/shell-frame";
import { MoveTimeline } from "@/components/timeline/move-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PieceSymbol } from "@/domain/game";
import type { ShellView } from "@/features/game/shell-view";
import { useLiveAnnouncements } from "@/features/game/use-live-announcements";
import type { ShellUi } from "@/features/game/use-shell-ui";

export type GameShellLayoutProps = {
  view: ShellView;
  ui: ShellUi;
  onMaiaEloChange: (elo: number) => void;
};

export function GameShellLayout({
  view,
  ui,
  onMaiaEloChange,
}: GameShellLayoutProps) {
  const announcements = useLiveAnnouncements({
    visibleInsight: view.coach.insight,
    evidenceGameNodeId: view.coach.evidenceGameNodeId,
    hint: view.coach.hint,
    navMessage: ui.navMessage,
    onNavMessageExpire: () => ui.queueNav(null),
  });

  const status = {
    ...view.status,
    announcement:
      ui.navMessage ||
      announcements.coachAnnouncement ||
      announcements.hintAnnouncement ||
      view.status.announcement,
  };

  const coach = (
    <CoachMascot
      expanded={view.coach.expanded}
      onExpandedChange={ui.handleCoachExpandedChange}
      insight={view.coach.insight}
      analyzing={view.coach.analyzing}
      onTrySuggested={
        view.coach.showTrySuggested ? ui.handleTrySuggested : undefined
      }
      onDismiss={() => {
        ui.handleDismissCoach();
        announcements.announce("Coach feedback dismissed.");
      }}
      hint={view.coach.hint}
      hintDisabled={view.coach.hintDisabled}
      hintFen={view.coach.hintFen}
      showTutorLaneHint={view.coach.showTutorLaneHint}
      onRequestHint={ui.handleRequestHint}
      idleHintEligible={view.coach.idleHintEligible}
      docked={view.coachDocked}
      laneLeft={view.coachLaneLeft}
      orientationTeaser={view.coach.orientationTeaser}
      mood={view.coach.mood}
    />
  );

  return (
    <TooltipProvider>
      <ShellFrame
        testId="game-shell"
        hydrated={view.hydrated}
        resumed={view.resumed}
        boardSize={view.boardSize}
        liveRegion={
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
            data-testid="live-region"
          >
            {status.announcement}
          </div>
        }
        header={
          <>
            <div className="flex min-w-0 items-center gap-2.5">
              <ChessgatorWordmark />
              <Badge
                variant={status.badgeVariant}
                data-testid="status-badge"
                data-mode={view.badgeMode}
                data-opponent-phase={view.maiaPhase}
              >
                {status.badgeLabel}
              </Badge>
              {view.stubMode ? (
                <Badge variant="outline" data-testid="stub-badge">
                  Stub mode
                </Badge>
              ) : null}
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Open settings"
              data-testid="settings-button"
              onClick={() => ui.setSettingsOpen(true)}
            >
              <RiSettings3Line />
            </Button>
          </>
        }
        footer={
          <>
            {coach}
            <div className="relative z-10 border-t border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
              <MoveTimeline
                graph={view.timeline.graph}
                focusedNodeId={view.timeline.focusedNodeId}
                startNodeId={view.timeline.startNodeId}
                liveNodeId={view.timeline.liveNodeId}
                mode={view.timeline.mode}
                statusText={view.timeline.statusText}
                canGoPrev={view.timeline.canGoPrev}
                canGoNext={view.timeline.canGoNext}
                prevNodeId={view.timeline.prevNodeId}
                nextNodeId={view.timeline.nextNodeId}
                canPracticeUndo={view.timeline.canPracticeUndo}
                canPracticeRedo={view.timeline.canPracticeRedo}
                canCommitPractice={view.timeline.canCommitPractice}
                canTakeBackLive={view.timeline.canTakeBackLive}
                disabled={view.timeline.disabled}
                orientation={view.timeline.orientation}
                onSelectDecision={ui.handleSelectDecision}
                onSelectNode={ui.handleSelectTimelineNode}
                onPreviewNode={ui.setPreviewNodeId}
                onReturnLive={ui.handleReturnLive}
                onOpenCoach={ui.handleOpenCoach}
                onPracticeUndo={ui.handlePracticeUndo}
                onPracticeRedo={ui.handlePracticeRedo}
                onCommitPractice={ui.handleCommitPractice}
                onCancelPractice={ui.handleCancelPractice}
                onTakeBackLive={ui.handleUndoHumanMove}
                className="rounded-none border-0 bg-transparent shadow-none ring-0"
              />
            </div>
          </>
        }
      >
        <div
          className={
            view.coachDocked
              ? "flex min-h-0 flex-1 items-center"
              : view.mascotBelow
                ? "flex min-h-0 flex-1 flex-col"
                : "relative min-h-0 flex-1"
          }
          style={
            view.coachDocked ? { paddingLeft: view.coachLaneLeft } : undefined
          }
        >
          {view.coachDocked ? (
            <aside
              className="min-h-0 shrink-0"
              style={{ width: COACH_COLUMN_WIDTH_PX }}
              data-testid="coach-column"
              aria-hidden
            />
          ) : null}
          <div
            className={
              view.coachDocked
                ? "flex shrink-0 items-center pl-4"
                : view.mascotBelow
                  ? "flex min-h-0 min-w-0 flex-1 items-start justify-center px-4 pt-3"
                  : "absolute"
            }
            style={
              view.coachDocked || view.mascotBelow
                ? undefined
                : {
                    left: view.boardLeft,
                    bottom: 12,
                    width: view.boardSize,
                    height: view.boardSize,
                  }
            }
          >
            <div
              className={
                view.coachDocked || view.mascotBelow
                  ? "relative shrink-0"
                  : "relative h-full w-full"
              }
              style={
                view.coachDocked || view.mascotBelow
                  ? {
                      width: view.boardSize,
                      height: view.boardSize,
                    }
                  : undefined
              }
              data-testid="board-frame"
            >
              <ChessboardAdapter
                fen={view.board.fen}
                interactive={view.board.interactive}
                orientation={view.board.orientation}
                lastMove={view.board.lastMove}
                isCheck={view.board.isCheck}
                checkSquare={view.board.checkSquare}
                highlightSquares={view.board.highlightSquares}
                squareLabels={view.board.labels}
                arrows={view.board.arrows}
                onMove={ui.applyPlayerMove}
                onPromotionNeeded={(from, to) => ui.setPromotion({ from, to })}
                className="h-full w-full"
              />
              <BoardPreviewVeil
                active={view.isViewingNonLive || view.isBoardPreview}
              />
              {view.isViewingNonLive ? (
                <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-2">
                  <Button
                    type="button"
                    size="sm"
                    className="pointer-events-auto shadow-md"
                    data-testid="review-pill"
                    onClick={ui.handleReturnLive}
                  >
                    Reviewing — Back to live
                  </Button>
                </div>
              ) : null}
              {view.gameOver.visible ? (
                <GameOverCard
                  headline={view.gameOver.headline}
                  detail={view.gameOver.detail}
                  mood={view.gameOver.mood}
                  pgn={view.gameOver.pgn}
                  onNewGame={ui.handleRestart}
                  onReview={ui.dismissGameOver}
                />
              ) : null}
            </div>
          </div>
          {view.mascotBelow && !view.coachDocked ? (
            <div
              className="shrink-0"
              style={{ height: MASCOT_PEEK_HEIGHT_PX }}
              aria-hidden
            />
          ) : null}
        </div>

        <FeedbackStack
          notices={view.notices}
          onDismissNotice={ui.dismissNotice}
        />
      </ShellFrame>

      <SettingsSheet
        open={ui.settingsOpen}
        onOpenChange={ui.handleSettingsOpenChange}
        maiaElo={view.settings.maiaElo}
        onMaiaEloChange={onMaiaEloChange}
        fen={view.settings.fen}
        canPlayMove={view.settings.canPlayMove}
        onSelectMove={(move) => {
          ui.applyPlayerMove(move);
        }}
        engine={{
          ...view.settings.engine,
          onRetry: () => {
            void ui.handleRetryEngines();
          },
        }}
        canResign={view.settings.canResign}
        canRestart
        confirmRestart={view.settings.confirmRestart}
        pgn={view.settings.pgn}
        pendingHumanColor={view.settings.pendingHumanColor}
        onPendingHumanColorChange={ui.setPendingHumanColor}
        onResign={ui.handleResign}
        onRestart={ui.handleRestart}
      />

      <PromotionDialog
        open={view.promotion.open}
        from={view.promotion.from}
        to={view.promotion.to}
        onCancel={() => ui.setPromotion(null)}
        onChoose={(piece: PieceSymbol) => {
          if (!ui.promotion) return;
          ui.applyPlayerMove({
            from: ui.promotion.from,
            to: ui.promotion.to,
            promotion: piece,
          });
        }}
      />
    </TooltipProvider>
  );
}
