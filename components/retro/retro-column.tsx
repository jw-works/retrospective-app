import type { ReactNode } from "react";
import type { RetroEntry, Side } from "@/lib/discussion";

type RetroColumnProps = {
  side: Side;
  title: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  items: RetroEntry[];
  onDropPanel: (side: Side) => void;
  onDropItem: (side: Side, targetId: string) => void;
  onDragStartEntry: (side: Side, id: string, dataTransfer: DataTransfer) => void;
  onDragStartGrouped: (side: Side, groupId: string, itemId: string, dataTransfer: DataTransfer) => void;
  onDragEnd: () => void;
  onToggleVote: (side: Side, id: string) => void;
  onRemove: (side: Side, id: string) => void;
  canRemove: (id: string) => boolean;
  onUndoGroupedItem: (side: Side, groupId: string, itemId: string) => void;
  renderEntryBadge: (entryId: string) => ReactNode;
};

export function RetroColumn({
  side,
  title,
  inputValue,
  onInputChange,
  onAdd,
  items,
  onDropPanel,
  onDropItem,
  onDragStartEntry,
  onDragStartGrouped,
  onDragEnd,
  onToggleVote,
  onRemove,
  canRemove,
  onUndoGroupedItem,
  renderEntryBadge
}: RetroColumnProps) {
  return (
    <section
      className="relative min-h-[220px] overflow-hidden rounded-[18px] border border-black/6 bg-[#eeeeef] p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-[''] max-[840px]:min-h-[200px]"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropPanel(side);
      }}
    >
      <h2 className="m-0 text-lg font-medium text-[#51555b]">{title}</h2>
      <div className="mt-[14px]">
        <div className="relative">
          <input
            className="block h-[42px] w-full rounded-[10px] border border-black/6 bg-white/45 px-3 pr-11 text-[#565b62] placeholder:text-[#9aa0a6]"
            type="text"
            placeholder="Type and press enter"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAdd();
              }
            }}
          />
          <button
            type="button"
            aria-label="Add"
            onClick={onAdd}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-[10px] border border-black/6 bg-white/55 text-[#6a7078] active:translate-y-[calc(-50%+1px)]"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2.2]">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
      <ul className="mt-[14px] flex list-none flex-col gap-2.5 p-0" aria-label={`${title} list`}>
        {items.map((item) => (
          <li
            key={item.id}
            draggable={item.kind === "item"}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", item.id);
              event.dataTransfer.effectAllowed = "move";
              onDragStartEntry(side, item.id, event.dataTransfer);
            }}
            onDragEnd={onDragEnd}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDropItem(side, item.id);
            }}
            className={`flex flex-wrap items-center gap-3 rounded-[14px] border border-black/6 bg-white/28 px-3 py-3 text-sm text-[#4f545a] ${
              item.kind === "item" ? "cursor-grab active:cursor-grabbing" : ""
            }`}
          >
            {item.kind === "item" ? (
              <span className="min-w-full flex-1 whitespace-normal pr-1.5 leading-[1.35]">{item.text}</span>
            ) : (
              <span className="min-w-full flex-1 pr-1.5 leading-[1.35]">
                <strong className="mb-1 block">{item.name}</strong>
                <ul className="space-y-1.5 pl-0">
                  {item.items.map((groupedItem) => (
                    <li
                      key={groupedItem.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", groupedItem.id);
                        event.dataTransfer.effectAllowed = "move";
                        onDragStartGrouped(side, item.id, groupedItem.id, event.dataTransfer);
                      }}
                      onDragEnd={onDragEnd}
                      className="flex cursor-grab items-center justify-between gap-2 rounded-[10px] border border-black/6 bg-white/50 px-2.5 py-1.5 text-[13px] text-[#565b62] active:cursor-grabbing"
                      title="Drag out to ungroup"
                    >
                      <span className="flex min-w-0 flex-1 items-start gap-2">
                        {renderEntryBadge(groupedItem.id)}
                        <span className="min-w-0 break-words">{groupedItem.text}</span>
                      </span>
                      <button
                        type="button"
                        aria-label="Undo from group"
                        title="Undo from group"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border border-black/6 bg-white/65 text-[#6a7078]"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onUndoGroupedItem(side, item.id, groupedItem.id);
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2]">
                          <path d="M9 7 5 11l4 4" />
                          <path d="M5 11h7a5 5 0 1 1 0 10h-3" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </span>
            )}
            <div className="mt-1 flex w-full items-end justify-between gap-2">
              <span>{item.kind === "item" ? renderEntryBadge(item.id) : null}</span>
              <span className="inline-flex items-center gap-2">
                <span className="min-w-5 text-right text-xs text-[#7a8088]">{item.votes}</span>
                <button
                  type="button"
                  aria-label="Upvote"
                  aria-pressed={item.voted}
                  onClick={() => onToggleVote(side, item.id)}
                  className={`h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078] transition ${
                    item.voted ? "border-black/12 bg-[#d2d4d8] text-[#4f545a]" : ""
                  }`}
                >
                  ↑
                </button>
                {canRemove(item.id) ? (
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => onRemove(side, item.id)}
                    className="h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078]"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
