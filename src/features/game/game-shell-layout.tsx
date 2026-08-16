"use client";

import { RiSettings3Line } from "@remixicon/react";
import { MotionConfig } from "motion/react";
import { ChessboardAdapter } from "@/components/board/chessboard-adapter";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { CoachMascot } from "@/components/coach/coach-mascot";
import { FeedbackStack } from "@/components/coach/feedback-stack";
import { MASCOT_PEEK_HEIGHT_PX } from "@/components/coach/gator-layout";
import { GameOverCard } from "@/components/game/game-over-card";
import { PromotionDialog } from "@/components/game/promotion-dialog";
import { SettingsSheet } from "@/components/game/settings-sheet";
import { ShellFrame } from "@/components/game/shell-frame";
import { SiteFooter } from "@/components/site-footer";
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
      hint={view.coach.hint}
      hintDisabled={view.coach.hintDisabled}
      hintFen={view.coach.hintFen}
      showSuggestedMoveHint={view.coach.showSuggestedMoveHint}
      onRequestHint={ui.handleRequestHint}
      idleHintEligible={view.coach.idleHintEligible}
      left={view.mascotLeft}
      orientationTeaser={view.coach.orientationTeaser}
      mood={view.coach.mood}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
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
                className="[&>svg]:transition-transform [&>svg]:duration-500 [&>svg]:ease-out hover:[&>svg]:rotate-90"
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
              <div className="relative z-10">
                <MoveTimeline
                  graph={view.timeline.graph}
                  focusedNodeId={view.timeline.focusedNodeId}
                  startNodeId={view.timeline.startNodeId}
                  canGoPrev={view.timeline.canGoPrev}
                  canGoNext={view.timeline.canGoNext}
                  prevNodeId={view.timeline.prevNodeId}
                  nextNodeId={view.timeline.nextNodeId}
                  disabled={view.timeline.disabled}
                  onSelectNode={ui.handleSelectTimelineNode}
                  onOpenCoach={ui.handleOpenCoach}
                  onPrune={ui.handlePruneTimelineNode}
                  expanded={ui.timelineExpanded}
                  onExpandedChange={ui.setTimelineExpanded}
                  className="rounded-none shadow-none ring-0"
                />
                <SiteFooter />
              </div>
            </>
          }
        >
          <div className="relative min-h-0 flex-1">
            <div
              className="absolute"
              style={{
                left: view.boardLeft,
                bottom: view.mascotBelow ? MASCOT_PEEK_HEIGHT_PX : 12,
                width: view.boardSize,
                height: view.boardSize,
              }}
            >
              <div className="relative h-full w-full" data-testid="board-frame">
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
                  onPromotionNeeded={(from, to) =>
                    ui.setPromotion({ from, to })
                  }
                  className="h-full w-full"
                />
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
    </MotionConfig>
  );
}
