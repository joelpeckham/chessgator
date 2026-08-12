"use client";

import { RiSettings3Line } from "@remixicon/react";
import { BoardPreviewVeil } from "@/components/board/board-preview-veil";
import { ChessboardAdapter } from "@/components/board/chessboard-adapter";
import { ChessgatorWordmark } from "@/components/brand/chessgator-wordmark";
import { CoachRail } from "@/components/coach/coach-rail";
import { FeedbackStack } from "@/components/coach/feedback-stack";
import { PromotionDialog } from "@/components/game/promotion-dialog";
import { SettingsSheet } from "@/components/game/settings-sheet";
import { ShellFrame } from "@/components/game/shell-frame";
import { MoveTimeline } from "@/components/timeline/move-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PieceSymbol } from "@/domain/game";
import type { ShellView } from "@/features/game/shell-view";
import { getStatusPresentation } from "@/features/game/status-copy";
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

  const status = getStatusPresentation({
    ...view.statusInput,
    coachAnnouncement: announcements.coachAnnouncement,
    hintAnnouncement: announcements.hintAnnouncement,
  });

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
            <CoachRail
              expanded={view.coach.expanded}
              onExpandedChange={(next) =>
                ui.handleCoachExpandedChange(next, view.coach.shouldAutoExpand)
              }
              insight={view.coach.insight}
              analyzing={view.coach.analyzing}
              canUndoHumanMove={view.coach.canUndoHumanMove}
              onUndoHumanMove={ui.handleUndoHumanMove}
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
              canExpand={view.coach.canExpand}
              onRequestHint={ui.handleRequestHint}
            />
            <MoveTimeline
              tree={view.timeline.tree}
              graph={view.timeline.graph}
              reviewNodeId={view.timeline.reviewNodeId}
              previewNodeId={view.timeline.previewNodeId}
              disabled={view.timeline.disabled}
              compact={view.timeline.compact}
              expandedOverflowKeys={view.timeline.expandedOverflowKeys}
              onExpandedOverflowChange={(keys) =>
                ui.setExpandedOverflowKeys([...keys])
              }
              onSelectNode={ui.handleSelectTimelineNode}
              onPreviewNode={ui.setPreviewNodeId}
              onReturnLive={ui.handleReturnLive}
              onOpenCoach={ui.handleOpenCoach}
              className="rounded-none border-0 bg-transparent shadow-none ring-0"
            />
          </>
        }
      >
        <div
          className="relative shrink-0"
          style={{
            width: view.boardSize,
            height: view.boardSize,
          }}
          data-testid="board-frame"
        >
          <ChessboardAdapter
            fen={view.board.fen}
            interactive={view.board.interactive}
            lastMove={view.board.lastMove}
            isCheck={view.board.isCheck}
            checkSquare={view.board.checkSquare}
            highlightSquares={view.board.highlightSquares}
            ghostSquares={[]}
            squareLabels={view.board.labels}
            arrows={view.board.arrows}
            onMove={ui.applyPlayerMove}
            onPromotionNeeded={(from, to) => ui.setPromotion({ from, to })}
            className="h-full w-full"
          />
          <BoardPreviewVeil active={view.isViewingNonLive} />
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
