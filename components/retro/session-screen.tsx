import type { ReactNode } from "react";
import { BoardStage } from "@/components/retro/session/board-stage";
import { DiscussionStage } from "@/components/retro/session/discussion-stage";
import { JoineesPanel } from "@/components/retro/session/joinees-panel";
import { SessionTopBar } from "@/components/retro/session/session-topbar";
import { SummaryStage } from "@/components/retro/session/summary-stage";
import type { DiscussionTopic, RetroEntry, Side } from "@/lib/discussion";

type ParticipantSummary = {
  id: string;
  name: string;
  isAdmin: boolean;
  votesRemaining: number;
};

type ActionItemSummary = {
  id: string;
  content: string;
};

type SessionScreenProps = {
  teamName: string;
  sessionId: string;
  sprintDisplayLabel: string;
  nextSprintDisplayLabel: string;
  showSprintLabel: boolean;
  inviteCopied: boolean;
  apiError: string | null;
  discussionMode: boolean;
  summaryMode: boolean;
  actionsMode: boolean;
  happinessMode: boolean;
  isAdmin: boolean;
  hasDiscussionItems: boolean;
  everyoneDoneVoting: boolean;
  actionItems: ActionItemSummary[];
  actionItemInput: string;
  totalParticipants: number;
  submittedHappinessCount: number;
  overallHappinessAverage: number | null;
  happinessSubmitted: boolean;
  happinessScore: number;
  happinessMood: { emoji: string; label: string };
  allHappinessSubmitted: boolean;
  currentDiscussion: DiscussionTopic | undefined;
  currentDiscussionEntryId: string;
  currentDiscussionEntry: RetroEntry | undefined;
  discussionIndex: number;
  discussionQueueLength: number;
  sortedRight: RetroEntry[];
  sortedWrong: RetroEntry[];
  participants: ParticipantSummary[];
  joineesDoneVoting: number;
  entryBadge: (entryId: string, size?: "sm" | "md") => ReactNode;
  onCopyInviteLink: () => void;
  onStartDiscussion: () => void;
  onBackToBoard: () => void;
  onEndSession: () => void;
  onActionItemInputChange: (value: string) => void;
  onAddActionItem: () => void;
  onRemoveActionItem: (id: string) => void;
  onProceedToHappiness: () => void;
  onHappinessScoreChange: (score: number) => void;
  onSubmitHappiness: () => void;
  onPreviousDiscussion: () => void;
  onNextDiscussion: () => void;
  onFinishDiscussion: () => void;
  onDropPanel: (side: Side) => void;
  onDropItem: (side: Side, targetId: string) => void;
  onDragStartEntry: (side: Side, id: string, dataTransfer: DataTransfer) => void;
  onDragStartGrouped: (side: Side, groupId: string, itemId: string, dataTransfer: DataTransfer) => void;
  onDragEnd: () => void;
  onToggleVote: (side: Side, id: string) => void;
  onRemoveItem: (side: Side, id: string) => void;
  onEditItem: (side: Side, id: string) => void;
  canRemove: (id: string) => boolean;
  canEdit: (id: string) => boolean;
  onUndoGroupedItem: (side: Side, groupId: string, itemId: string) => void;
  wentRightInput: string;
  wentWrongInput: string;
  onWentRightInputChange: (value: string) => void;
  onWentWrongInputChange: (value: string) => void;
  onAddWentRight: () => void;
  onAddWentWrong: () => void;
};

export function SessionScreen({
  teamName,
  sessionId,
  sprintDisplayLabel,
  nextSprintDisplayLabel,
  showSprintLabel,
  inviteCopied,
  apiError,
  discussionMode,
  summaryMode,
  actionsMode,
  happinessMode,
  isAdmin,
  hasDiscussionItems,
  everyoneDoneVoting,
  actionItems,
  actionItemInput,
  totalParticipants,
  submittedHappinessCount,
  overallHappinessAverage,
  happinessSubmitted,
  happinessScore,
  happinessMood,
  allHappinessSubmitted,
  currentDiscussion,
  currentDiscussionEntryId,
  currentDiscussionEntry,
  discussionIndex,
  discussionQueueLength,
  sortedRight,
  sortedWrong,
  participants,
  joineesDoneVoting,
  entryBadge,
  onCopyInviteLink,
  onStartDiscussion,
  onBackToBoard,
  onEndSession,
  onActionItemInputChange,
  onAddActionItem,
  onRemoveActionItem,
  onProceedToHappiness,
  onHappinessScoreChange,
  onSubmitHappiness,
  onPreviousDiscussion,
  onNextDiscussion,
  onFinishDiscussion,
  onDropPanel,
  onDropItem,
  onDragStartEntry,
  onDragStartGrouped,
  onDragEnd,
  onToggleVote,
  onRemoveItem,
  onEditItem,
  canRemove,
  canEdit,
  onUndoGroupedItem,
  wentRightInput,
  wentWrongInput,
  onWentRightInputChange,
  onWentWrongInputChange,
  onAddWentRight,
  onAddWentWrong,
}: SessionScreenProps) {
  const mainStage = summaryMode ? (
    <SummaryStage
      teamName={teamName}
      sessionId={sessionId}
      sprintDisplayLabel={sprintDisplayLabel}
      nextSprintDisplayLabel={nextSprintDisplayLabel}
      showSprintLabel={showSprintLabel}
      actionItems={actionItems}
      overallHappinessAverage={overallHappinessAverage}
      totalParticipants={totalParticipants}
      submittedHappinessCount={submittedHappinessCount}
      sortedRight={sortedRight}
      sortedWrong={sortedWrong}
      entryBadge={entryBadge}
    />
  ) : discussionMode ? (
    <DiscussionStage
      actionsMode={actionsMode}
      happinessMode={happinessMode}
      isAdmin={isAdmin}
      showSprintLabel={showSprintLabel}
      sprintDisplayLabel={sprintDisplayLabel}
      nextSprintDisplayLabel={nextSprintDisplayLabel}
      actionItems={actionItems}
      actionItemInput={actionItemInput}
      onActionItemInputChange={onActionItemInputChange}
      onAddActionItem={onAddActionItem}
      onRemoveActionItem={onRemoveActionItem}
      happinessMood={happinessMood}
      happinessScore={happinessScore}
      onHappinessScoreChange={onHappinessScoreChange}
      happinessSubmitted={happinessSubmitted}
      allHappinessSubmitted={allHappinessSubmitted}
      overallHappinessAverage={overallHappinessAverage}
      submittedHappinessCount={submittedHappinessCount}
      totalParticipants={totalParticipants}
      currentDiscussion={currentDiscussion}
      currentDiscussionEntryId={currentDiscussionEntryId}
      currentDiscussionEntry={currentDiscussionEntry}
      entryBadge={entryBadge}
      onSubmitHappiness={onSubmitHappiness}
      onProceedToHappiness={onProceedToHappiness}
      discussionIndex={discussionIndex}
      discussionQueueLength={discussionQueueLength}
      onPreviousDiscussion={onPreviousDiscussion}
      onNextDiscussion={onNextDiscussion}
      onFinishDiscussion={onFinishDiscussion}
    />
  ) : (
    <BoardStage
      sortedRight={sortedRight}
      sortedWrong={sortedWrong}
      wentRightInput={wentRightInput}
      wentWrongInput={wentWrongInput}
      onWentRightInputChange={onWentRightInputChange}
      onWentWrongInputChange={onWentWrongInputChange}
      onAddWentRight={onAddWentRight}
      onAddWentWrong={onAddWentWrong}
      onDropPanel={onDropPanel}
      onDropItem={onDropItem}
      onDragStartEntry={onDragStartEntry}
      onDragStartGrouped={onDragStartGrouped}
      onDragEnd={onDragEnd}
      onToggleVote={onToggleVote}
      onRemoveItem={onRemoveItem}
      onEditItem={onEditItem}
      canRemove={canRemove}
      canEdit={canEdit}
      onUndoGroupedItem={onUndoGroupedItem}
      entryBadge={entryBadge}
    />
  );

  return (
    <>
      <SessionTopBar
        teamName={teamName}
        sessionId={sessionId}
        sprintDisplayLabel={sprintDisplayLabel}
        showSprintLabel={showSprintLabel}
        inviteCopied={inviteCopied}
        apiError={apiError}
        discussionMode={discussionMode}
        isAdmin={isAdmin}
        hasDiscussionItems={hasDiscussionItems}
        everyoneDoneVoting={everyoneDoneVoting}
        onCopyInviteLink={onCopyInviteLink}
        onStartDiscussion={onStartDiscussion}
        onBackToBoard={onBackToBoard}
        onEndSession={onEndSession}
      />

      <section className="grid grid-cols-[1.2fr_1.2fr_0.9fr] items-stretch gap-[22px] max-[840px]:grid-cols-1">
        {mainStage}

        {!summaryMode ? (
          <JoineesPanel
            participants={participants}
            joineesDoneVoting={joineesDoneVoting}
            totalParticipants={totalParticipants}
          />
        ) : null}
      </section>
    </>
  );
}
