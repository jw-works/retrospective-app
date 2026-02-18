import type { ReactNode } from "react";
import type { RetroEntry } from "@/lib/discussion";

type ActionItemSummary = {
  id: string;
  content: string;
};

type SummaryStageProps = {
  teamName: string;
  sessionId: string;
  sprintDisplayLabel: string;
  nextSprintDisplayLabel: string;
  showSprintLabel: boolean;
  actionItems: ActionItemSummary[];
  overallHappinessAverage: number | null;
  totalParticipants: number;
  submittedHappinessCount: number;
  sortedRight: RetroEntry[];
  sortedWrong: RetroEntry[];
  entryBadge: (entryId: string, size?: "sm" | "md") => ReactNode;
};

type SummaryColumnProps = {
  title: string;
  items: RetroEntry[];
  entryBadge: (entryId: string, size?: "sm" | "md") => ReactNode;
};

function SummaryColumn({ title, items, entryBadge }: SummaryColumnProps) {
  return (
    <section className="rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
      <h3 className="text-base font-medium text-retro-strong">{title}</h3>
      <ul className="mt-3 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 py-2 text-sm text-retro-strong"
          >
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
  );
}

export function SummaryStage({
  teamName,
  sessionId,
  sprintDisplayLabel,
  nextSprintDisplayLabel,
  showSprintLabel,
  actionItems,
  overallHappinessAverage,
  totalParticipants,
  submittedHappinessCount,
  sortedRight,
  sortedWrong,
  entryBadge,
}: SummaryStageProps) {
  return (
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
            {showSprintLabel ? `Top Priorities for ${nextSprintDisplayLabel || sprintDisplayLabel}` : "Top Priorities"}
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
          <SummaryColumn title="What Went Right" items={sortedRight} entryBadge={entryBadge} />
          <SummaryColumn title="What Went Wrong" items={sortedWrong} entryBadge={entryBadge} />
        </div>
      </div>
    </section>
  );
}
