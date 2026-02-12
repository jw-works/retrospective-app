import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { DiscussionTopic, RetroEntry } from "@/lib/discussion";

type ActionItemSummary = {
  id: string;
  content: string;
};

type DiscussionStageProps = {
  actionsMode: boolean;
  happinessMode: boolean;
  isAdmin: boolean;
  showSprintLabel: boolean;
  sprintDisplayLabel: string;
  nextSprintDisplayLabel: string;
  actionItems: ActionItemSummary[];
  actionItemInput: string;
  onActionItemInputChange: (value: string) => void;
  onAddActionItem: () => void;
  onRemoveActionItem: (id: string) => void;
  happinessMood: { emoji: string; label: string };
  happinessScore: number;
  onHappinessScoreChange: (score: number) => void;
  happinessSubmitted: boolean;
  allHappinessSubmitted: boolean;
  overallHappinessAverage: number | null;
  submittedHappinessCount: number;
  totalParticipants: number;
  currentDiscussion: DiscussionTopic | undefined;
  currentDiscussionEntryId: string;
  currentDiscussionEntry: RetroEntry | undefined;
  entryBadge: (entryId: string, size?: "sm" | "md") => ReactNode;
  onSubmitHappiness: () => void;
  onProceedToHappiness: () => void;
  discussionIndex: number;
  discussionQueueLength: number;
  onPreviousDiscussion: () => void;
  onNextDiscussion: () => void;
  onFinishDiscussion: () => void;
};

export function DiscussionStage({
  actionsMode,
  happinessMode,
  isAdmin,
  showSprintLabel,
  sprintDisplayLabel,
  nextSprintDisplayLabel,
  actionItems,
  actionItemInput,
  onActionItemInputChange,
  onAddActionItem,
  onRemoveActionItem,
  happinessMood,
  happinessScore,
  onHappinessScoreChange,
  happinessSubmitted,
  allHappinessSubmitted,
  overallHappinessAverage,
  submittedHappinessCount,
  totalParticipants,
  currentDiscussion,
  currentDiscussionEntryId,
  currentDiscussionEntry,
  entryBadge,
  onSubmitHappiness,
  onProceedToHappiness,
  discussionIndex,
  discussionQueueLength,
  onPreviousDiscussion,
  onNextDiscussion,
  onFinishDiscussion,
}: DiscussionStageProps) {
  return (
    <section className="relative col-span-2 flex min-h-[220px] flex-col overflow-hidden rounded-[18px] border border-retro-border-soft bg-retro-surface p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-white/0 before:content-[''] dark:before:bg-none max-[840px]:col-span-1 max-[840px]:min-h-[200px]">
      <div className="relative z-10 flex min-h-[320px] flex-1 flex-col">
        <div className="flex-1">
          {actionsMode ? (
            <div>
              <p className="text-sm text-retro-muted">
                {showSprintLabel ? `${nextSprintDisplayLabel || sprintDisplayLabel} goals` : "Sprint goals"}
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
                  <span className="text-xl leading-none" aria-hidden>{happinessMood.emoji}</span>
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
          <div className="mt-auto pt-6 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-stretch">
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
  );
}
