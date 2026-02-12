import type { ReactNode } from "react";
import type { DiscussionTopic, RetroEntry, Side } from "@/lib/discussion";
import { BoardStage } from "@/components/retro/session/board-stage";
import { DiscussionStage } from "@/components/retro/session/discussion-stage";
import { JoineesPanel } from "@/components/retro/session/joinees-panel";
import { SessionTopBar } from "@/components/retro/session/session-topbar";
import { SummaryStage } from "@/components/retro/session/summary-stage";

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

export function SessionScreen(props: SessionScreenProps) {
  return (
    <>
      <SessionTopBar
        teamName={props.teamName}
        sessionId={props.sessionId}
        sprintDisplayLabel={props.sprintDisplayLabel}
        showSprintLabel={props.showSprintLabel}
        inviteCopied={props.inviteCopied}
        apiError={props.apiError}
        discussionMode={props.discussionMode}
        isAdmin={props.isAdmin}
        hasDiscussionItems={props.hasDiscussionItems}
        everyoneDoneVoting={props.everyoneDoneVoting}
        onCopyInviteLink={props.onCopyInviteLink}
        onStartDiscussion={props.onStartDiscussion}
        onBackToBoard={props.onBackToBoard}
        onEndSession={props.onEndSession}
      />

      <section className="grid grid-cols-[1.2fr_1.2fr_0.9fr] items-stretch gap-[22px] max-[840px]:grid-cols-1">
        {props.summaryMode ? (
          <SummaryStage
            teamName={props.teamName}
            sessionId={props.sessionId}
            sprintDisplayLabel={props.sprintDisplayLabel}
            nextSprintDisplayLabel={props.nextSprintDisplayLabel}
            showSprintLabel={props.showSprintLabel}
            actionItems={props.actionItems}
            overallHappinessAverage={props.overallHappinessAverage}
            totalParticipants={props.totalParticipants}
            submittedHappinessCount={props.submittedHappinessCount}
            sortedRight={props.sortedRight}
            sortedWrong={props.sortedWrong}
            entryBadge={props.entryBadge}
          />
        ) : props.discussionMode ? (
          <DiscussionStage
            actionsMode={props.actionsMode}
            happinessMode={props.happinessMode}
            isAdmin={props.isAdmin}
            showSprintLabel={props.showSprintLabel}
            sprintDisplayLabel={props.sprintDisplayLabel}
            nextSprintDisplayLabel={props.nextSprintDisplayLabel}
            actionItems={props.actionItems}
            actionItemInput={props.actionItemInput}
            onActionItemInputChange={props.onActionItemInputChange}
            onAddActionItem={props.onAddActionItem}
            onRemoveActionItem={props.onRemoveActionItem}
            happinessMood={props.happinessMood}
            happinessScore={props.happinessScore}
            onHappinessScoreChange={props.onHappinessScoreChange}
            happinessSubmitted={props.happinessSubmitted}
            allHappinessSubmitted={props.allHappinessSubmitted}
            overallHappinessAverage={props.overallHappinessAverage}
            submittedHappinessCount={props.submittedHappinessCount}
            totalParticipants={props.totalParticipants}
            currentDiscussion={props.currentDiscussion}
            currentDiscussionEntryId={props.currentDiscussionEntryId}
            currentDiscussionEntry={props.currentDiscussionEntry}
            entryBadge={props.entryBadge}
            onSubmitHappiness={props.onSubmitHappiness}
            onProceedToHappiness={props.onProceedToHappiness}
            discussionIndex={props.discussionIndex}
            discussionQueueLength={props.discussionQueueLength}
            onPreviousDiscussion={props.onPreviousDiscussion}
            onNextDiscussion={props.onNextDiscussion}
            onFinishDiscussion={props.onFinishDiscussion}
          />
        ) : (
          <BoardStage
            sortedRight={props.sortedRight}
            sortedWrong={props.sortedWrong}
            wentRightInput={props.wentRightInput}
            wentWrongInput={props.wentWrongInput}
            onWentRightInputChange={props.onWentRightInputChange}
            onWentWrongInputChange={props.onWentWrongInputChange}
            onAddWentRight={props.onAddWentRight}
            onAddWentWrong={props.onAddWentWrong}
            onDropPanel={props.onDropPanel}
            onDropItem={props.onDropItem}
            onDragStartEntry={props.onDragStartEntry}
            onDragStartGrouped={props.onDragStartGrouped}
            onDragEnd={props.onDragEnd}
            onToggleVote={props.onToggleVote}
            onRemoveItem={props.onRemoveItem}
            onEditItem={props.onEditItem}
            canRemove={props.canRemove}
            canEdit={props.canEdit}
            onUndoGroupedItem={props.onUndoGroupedItem}
            entryBadge={props.entryBadge}
          />
        )}

        {!props.summaryMode ? (
          <JoineesPanel
            participants={props.participants}
            joineesDoneVoting={props.joineesDoneVoting}
            totalParticipants={props.totalParticipants}
          />
        ) : null}
      </section>
    </>
  );
}
