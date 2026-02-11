import type { ReactNode } from "react";
import { Share2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { RetroColumn } from "@/components/retro/retro-column";
import type { DiscussionTopic, RetroEntry, Side } from "@/lib/discussion";
import { colorToneIndexFromSeed, initialsFromName } from "@/lib/retro/utils";

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
  const shortParticipantId = (id: string) => id.split("-")[0] ?? id.slice(0, 8);

  return (
    <>
      <section className="my-[14px] mb-[26px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-[34px] leading-[1.15] font-medium text-retro-heading">{teamName.trim()} Retrospective</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-retro-muted">
              {showSprintLabel ? (
                <span className="rounded-[10px] border border-retro-border bg-retro-surface-soft px-2.5 py-1">{sprintDisplayLabel}</span>
              ) : null}
              <span className="rounded-[10px] border border-retro-border bg-retro-surface-soft px-2.5 py-1">{sessionId}</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-[10px] border border-retro-border bg-retro-surface-soft px-2.5 py-1 text-retro-body"
                onClick={onCopyInviteLink}
              >
                <Share2 className="size-3.5" />
                {inviteCopied ? "Copied" : "Copy invite link"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!discussionMode ? (
              <Button type="button" onClick={onStartDiscussion} disabled={!hasDiscussionItems || !isAdmin}>
                {everyoneDoneVoting ? "Start Discussion" : "Start Discussion Anyway"}
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled={!isAdmin} onClick={onBackToBoard}>
                Back To Board
              </Button>
            )}
            {isAdmin ? (
              <Button type="button" variant="outline" onClick={onEndSession}>
                End Session
              </Button>
            ) : null}
          </div>
        </div>
        {apiError ? <p className="mt-2 text-sm text-retro-danger">{apiError}</p> : null}
      </section>

      <section className="grid grid-cols-[1.2fr_1.2fr_0.9fr] items-stretch gap-[22px] max-[840px]:grid-cols-1">
        {summaryMode ? (
          <section className="relative col-span-3 overflow-hidden rounded-[18px] border border-retro-border-soft bg-retro-surface p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-white/0 before:content-[''] dark:before:bg-none">
            <div className="relative z-10">
              <p className="text-sm text-retro-muted">Session complete</p>
              <h2 className="mt-2 text-[30px] leading-[1.1] font-medium text-retro-heading">Retrospective Summary</h2>
              <p className="mt-2 text-sm text-retro-muted">
                {teamName.trim()}
                {showSprintLabel ? ` · ${sprintDisplayLabel}` : ""} · {sessionId}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3 max-[980px]:grid-cols-2 max-[640px]:grid-cols-1">
                <div className="rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
                  <p className="text-xs tracking-[0.18em] text-retro-muted uppercase">Action Items</p>
                  <p className="mt-2 text-2xl font-semibold text-retro-heading">{actionItems.length}</p>
                  <p className="mt-1 text-xs text-retro-muted">defined for next sprint</p>
                </div>
                <div className="rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
                  <p className="text-xs tracking-[0.18em] text-retro-muted uppercase">Happiness Avg</p>
                  <p className="mt-2 text-2xl font-semibold text-retro-heading">{overallHappinessAverage?.toFixed(1) ?? "0.0"} / 10</p>
                </div>
                <div className="rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
                  <p className="text-xs tracking-[0.18em] text-retro-muted uppercase">Participants</p>
                  <p className="mt-2 text-2xl font-semibold text-retro-heading">{totalParticipants}</p>
                  <p className="mt-1 text-xs text-retro-muted">{submittedHappinessCount} happiness responses</p>
                </div>
              </div>

              <section className="mt-5 rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
                <h3 className="text-base font-medium text-retro-strong">
                  {showSprintLabel
                    ? `Top Priorities for ${nextSprintDisplayLabel || sprintDisplayLabel}`
                    : "Top Priorities"}
                </h3>
                {actionItems.length > 0 ? (
                  <ul className="mt-3 flex list-none flex-col gap-2 p-0">
                    {actionItems.map((item) => (
                      <li key={item.id} className="rounded-[10px] border border-retro-border-soft bg-retro-card-strong px-3 py-2">
                        <span className="block break-words text-sm text-retro-strong">{item.content}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-retro-muted">No prioritized topics yet.</p>
                )}
              </section>

              <div className="mt-6 grid grid-cols-2 gap-4 max-[840px]:grid-cols-1">
                <section className="rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
                  <h3 className="text-base font-medium text-retro-strong">What Went Right</h3>
                  <ul className="mt-3 flex list-none flex-col gap-2 p-0">
                    {sortedRight.map((item) => (
                      <li key={item.id} className="rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 py-2 text-sm text-retro-strong">
                        {item.kind === "item" ? (
                          <>
                            <p className="break-words">{item.text}</p>
                            <div className="mt-2 flex items-center justify-between">
                              {entryBadge(item.id)}
                              <span className="text-xs text-retro-muted">{item.votes} votes</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">{item.name}</p>
                            <ul className="mt-2 flex list-none flex-col gap-1 p-0">
                              {item.items.map((groupedItem) => (
                                <li key={groupedItem.id} className="flex items-start gap-2 text-xs text-retro-body">
                                  {entryBadge(groupedItem.id)}
                                  <span className="break-words">{groupedItem.text}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-right text-xs text-retro-muted">{item.votes} votes</p>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
                  <h3 className="text-base font-medium text-retro-strong">What Went Wrong</h3>
                  <ul className="mt-3 flex list-none flex-col gap-2 p-0">
                    {sortedWrong.map((item) => (
                      <li key={item.id} className="rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 py-2 text-sm text-retro-strong">
                        {item.kind === "item" ? (
                          <>
                            <p className="break-words">{item.text}</p>
                            <div className="mt-2 flex items-center justify-between">
                              {entryBadge(item.id)}
                              <span className="text-xs text-retro-muted">{item.votes} votes</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">{item.name}</p>
                            <ul className="mt-2 flex list-none flex-col gap-1 p-0">
                              {item.items.map((groupedItem) => (
                                <li key={groupedItem.id} className="flex items-start gap-2 text-xs text-retro-body">
                                  {entryBadge(groupedItem.id)}
                                  <span className="break-words">{groupedItem.text}</span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-right text-xs text-retro-muted">{item.votes} votes</p>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </section>
        ) : discussionMode ? (
          <section className="relative col-span-2 min-h-[220px] overflow-hidden rounded-[18px] border border-retro-border-soft bg-retro-surface p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-white/0 before:content-[''] dark:before:bg-none max-[840px]:col-span-1 max-[840px]:min-h-[200px]">
            <div className="relative z-10 flex h-full min-h-[320px] flex-col">
              <div className={!happinessMode && !actionsMode && currentDiscussion ? "pb-16" : ""}>
                {actionsMode ? (
                  <div>
                    <p className="text-sm text-retro-muted">
                      {showSprintLabel
                        ? `${nextSprintDisplayLabel || sprintDisplayLabel} goals`
                        : "Sprint goals"}
                    </p>
                    <h2 className="mt-2 text-[26px] leading-[1.2] font-medium text-retro-heading">Action Items</h2>
                    <p className="mt-2 text-sm text-retro-muted">
                      {isAdmin
                        ? "Capture concrete action items for the next sprint."
                        : "The facilitator is capturing action items for the next sprint."}
                    </p>
                    <section className="mt-5 relative min-h-[220px] overflow-hidden rounded-[18px] border border-retro-border-soft bg-retro-surface p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-white/0 before:content-[''] dark:before:bg-none">
                      <div className="relative z-10">
                        {isAdmin ? (
                          <div className="relative">
                            <Textarea
                              className="block min-h-[86px] w-full resize-y rounded-[10px] border border-retro-border-soft bg-retro-card px-3 py-2 pr-11 text-retro-strong placeholder:text-retro-subtle"
                              placeholder="Add an action item. Enter to add, Shift+Enter for newline."
                              value={actionItemInput}
                              onChange={(event) => onActionItemInputChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  onAddActionItem();
                                }
                              }}
                            />
                            <button
                              type="button"
                              aria-label="Add action item"
                              onClick={onAddActionItem}
                              className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-[10px] border border-retro-border-soft bg-retro-card-hover text-retro-body active:translate-y-px"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2.2]">
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <p className="rounded-[12px] border border-retro-border-soft bg-retro-card px-3 py-2 text-sm text-retro-muted">
                            Waiting for facilitator to add action items.
                          </p>
                        )}
                        <ul className="mt-[14px] flex list-none flex-col gap-2.5 p-0">
                          {actionItems.map((item, index) => (
                            <li key={item.id} className="flex items-start justify-between gap-3 rounded-[14px] border border-retro-border-soft bg-retro-card px-3 py-3 text-sm text-retro-body">
                              <span className="min-w-0 break-words">
                                <span className="mr-2 text-retro-muted">{index + 1}.</span>
                                {item.content}
                              </span>
                              {isAdmin ? (
                                <button
                                  type="button"
                                  aria-label="Remove action item"
                                  className="h-[30px] w-[30px] rounded-[10px] border border-retro-border-soft bg-retro-card-hover text-center leading-7 text-retro-body"
                                  onClick={() => onRemoveActionItem(item.id)}
                                >
                                  ×
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        {actionItems.length === 0 ? <p className="mt-2 text-sm text-retro-muted">No action items captured yet.</p> : null}
                      </div>
                    </section>
                  </div>
                ) : happinessMode ? (
                  <div className="max-w-xl">
                    <p className="text-sm text-retro-muted">Session complete</p>
                    <h2 className="mt-2 text-[26px] leading-[1.2] font-medium text-retro-heading">Happiness Check</h2>
                    <p className="mt-2 text-sm text-retro-muted">How do you feel about this retrospective session?</p>
                    <div className="mt-5">
                      <div className="mb-2 flex items-center gap-2 text-sm text-retro-strong">
                        <span className="text-xl leading-none" aria-hidden>
                          {happinessMood.emoji}
                        </span>
                        <span>{happinessMood.label}</span>
                      </div>
                      <Slider min={1} max={10} step={1} value={[happinessScore]} onValueChange={(values) => onHappinessScoreChange(values[0] ?? 7)} className="w-full" />
                      <div className="mt-1 flex justify-between text-xs text-retro-muted">
                        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
                      </div>
                    </div>
                    {happinessSubmitted ? <p className="mt-5 text-sm text-retro-strong">Thanks. Happiness score recorded.</p> : null}
                    {allHappinessSubmitted ? (
                      <div className="mt-5 rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
                        <p className="text-xs tracking-[0.18em] text-retro-muted uppercase">Team Result</p>
                        <p className="mt-2 text-2xl font-semibold text-retro-heading">{overallHappinessAverage?.toFixed(1) ?? "0.0"} / 10</p>
                        <p className="mt-1 text-sm text-retro-muted">{submittedHappinessCount} of {totalParticipants} participants submitted.</p>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-retro-muted">
                        Waiting for {Math.max(0, totalParticipants - submittedHappinessCount)} more participant
                        {Math.max(0, totalParticipants - submittedHappinessCount) === 1 ? "" : "s"} to submit.
                      </p>
                    )}
                  </div>
                ) : currentDiscussion ? (
                  <>
                    <p className="text-sm text-retro-muted">
                      {currentDiscussion.side === "right" ? "What went right" : "What went wrong"} · {currentDiscussion.votes} votes
                    </p>
                    <div className="mt-2 flex items-start gap-3">
                      {currentDiscussion.kind === "item" && currentDiscussionEntryId ? entryBadge(currentDiscussionEntryId, "md") : null}
                      <h2 className="break-words text-[26px] leading-[1.2] font-medium text-retro-heading">{currentDiscussion.title}</h2>
                    </div>
                    {currentDiscussion.kind === "group" ? (
                      <ul className="mt-4 flex list-none flex-col gap-2 p-0">
                        {(currentDiscussionEntry?.kind === "group" ? currentDiscussionEntry.items : []).map((item) => (
                          <li key={item.id} className="flex items-start gap-2 rounded-[12px] border border-retro-border-soft bg-retro-card px-3 py-2 text-sm text-retro-strong">
                            {entryBadge(item.id)}
                            <span className="break-words">{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-retro-muted">No topics available yet.</p>
                )}
              </div>

              {happinessMode && !happinessSubmitted ? (
                <div className="mt-6 flex justify-end">
                  <Button type="button" onClick={onSubmitHappiness}>Submit Check</Button>
                </div>
              ) : null}

              {actionsMode ? (
                <div className="mt-6 flex justify-end">
                  <Button type="button" onClick={onProceedToHappiness} disabled={!isAdmin}>
                    Happiness Check
                  </Button>
                </div>
              ) : null}

              {!happinessMode && !actionsMode && currentDiscussion ? (
                <div className="absolute right-0 bottom-0 left-0 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-stretch">
                  <span className="text-sm text-retro-muted">{discussionIndex + 1}/{discussionQueueLength}</span>
                  <div className="flex items-center gap-2 self-end max-[640px]:self-stretch max-[640px]:justify-end">
                    <Button type="button" variant="outline" onClick={onPreviousDiscussion} disabled={discussionIndex === 0 || !isAdmin}>
                      Previous
                    </Button>
                    {discussionIndex >= discussionQueueLength - 1 ? (
                      <Button type="button" onClick={onFinishDiscussion} disabled={!isAdmin}>
                        Action Items
                      </Button>
                    ) : (
                      <Button type="button" onClick={onNextDiscussion} disabled={!isAdmin}>
                        Next Topic
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <>
            <RetroColumn
              side="right"
              title="What went right"
              inputValue={wentRightInput}
              onInputChange={onWentRightInputChange}
              onAdd={onAddWentRight}
              items={sortedRight}
              onDropPanel={onDropPanel}
              onDropItem={onDropItem}
              onDragStartEntry={onDragStartEntry}
              onDragStartGrouped={onDragStartGrouped}
              onDragEnd={onDragEnd}
              onToggleVote={onToggleVote}
              onRemove={onRemoveItem}
              onEdit={onEditItem}
              canRemove={canRemove}
              canEdit={canEdit}
              onUndoGroupedItem={onUndoGroupedItem}
              renderEntryBadge={entryBadge}
            />

            <RetroColumn
              side="wrong"
              title="What went wrong"
              inputValue={wentWrongInput}
              onInputChange={onWentWrongInputChange}
              onAdd={onAddWentWrong}
              items={sortedWrong}
              onDropPanel={onDropPanel}
              onDropItem={onDropItem}
              onDragStartEntry={onDragStartEntry}
              onDragStartGrouped={onDragStartGrouped}
              onDragEnd={onDragEnd}
              onToggleVote={onToggleVote}
              onRemove={onRemoveItem}
              onEdit={onEditItem}
              canRemove={canRemove}
              canEdit={canEdit}
              onUndoGroupedItem={onUndoGroupedItem}
              renderEntryBadge={entryBadge}
            />
          </>
        )}

        {!summaryMode ? (
          <aside className="flex flex-col gap-4">
            <section className="relative overflow-hidden rounded-2xl border border-retro-border-soft bg-retro-surface p-[18px] shadow-[0_18px_38px_rgba(0,0,0,0.05)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-white/0 before:content-[''] dark:before:bg-none">
              <div className="relative z-10">
                <h3 className="m-0 text-base font-medium text-retro-strong">Joinees List</h3>
                <div className="mt-2 rounded-[12px] border border-retro-border-soft bg-retro-card px-3 py-2">
                  <p className="text-xs text-retro-muted">Voting progress: {joineesDoneVoting}/{totalParticipants} done</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-retro-surface-soft">
                    <div
                      className="h-full rounded-full bg-[var(--retro-action)] transition-all"
                      style={{ width: totalParticipants > 0 ? `${(joineesDoneVoting / totalParticipants) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
                <ul aria-label="Joinees list" className="mt-3 flex list-none flex-col gap-2.5 p-0">
                  {participants.map((person) => (
                    <li key={person.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-retro-border-soft bg-retro-card px-3 py-3">
                      <span className="inline-flex min-w-0 items-center gap-2.5 text-sm text-retro-body">
                        <Avatar aria-hidden className={`identity-badge identity-tone-${colorToneIndexFromSeed(person.id)} size-[24px] border`}>
                          <AvatarFallback className="bg-transparent text-[10px] font-semibold text-inherit">
                            {initialsFromName(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block truncate">{person.name}</span>
                          <span className="block text-[11px] text-retro-subtle">ID {shortParticipantId(person.id)}</span>
                        </span>
                      </span>
                      {person.isAdmin ? <span className="text-xs text-retro-muted">admin</span> : <span className="text-xs text-retro-muted">{person.votesRemaining} left</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </aside>
        ) : null}
      </section>
    </>
  );
}
