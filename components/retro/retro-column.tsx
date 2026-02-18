import type { MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import type { RetroEntry, Side } from "@/lib/discussion";

// Reusable board column used by both "went right" and "went wrong" sections.
// The parent owns state and passes callbacks for mutation/drag/drop behaviors.
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
  onEdit: (side: Side, id: string) => void;
  canRemove: (id: string) => boolean;
  canEdit: (id: string) => boolean;
  onUndoGroupedItem: (side: Side, groupId: string, itemId: string) => void;
  renderEntryBadge: (entryId: string) => ReactNode;
};

type IconActionButtonProps = {
  label: string;
  title?: string;
  className?: string;
  disabled?: boolean;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
};

function IconActionButton({
  label,
  title,
  className,
  disabled,
  onMouseDown,
  onClick,
  children,
}: IconActionButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={title}
      className={cn("border-retro-border-soft bg-retro-card-hover p-0 text-retro-body", className)}
      disabled={disabled}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

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
  onEdit,
  canRemove,
  canEdit,
  onUndoGroupedItem,
  renderEntryBadge,
}: RetroColumnProps) {
  return (
    <section
      className="relative min-h-[220px] overflow-hidden rounded-[18px] border border-retro-border-soft bg-retro-surface p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-white/0 before:content-[''] dark:before:bg-none max-[840px]:min-h-[200px]"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropPanel(side);
      }}
    >
      <h2 className="m-0 text-lg font-medium text-retro-strong">{title}</h2>
      <div className="mt-[14px]">
        <div className="relative">
          <Textarea
            className="block min-h-[86px] w-full resize-y rounded-[10px] border border-retro-border-soft bg-retro-card px-3 py-2 pr-11 text-retro-strong placeholder:text-retro-subtle"
            placeholder="Type your comment. Enter to add, Shift+Enter for newline."
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onAdd();
              }
            }}
          />
          <IconActionButton
            label="Add"
            className="absolute right-2 bottom-2 size-8 rounded-[10px] active:translate-y-px"
            onClick={() => onAdd()}
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2.2]">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </IconActionButton>
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
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-[14px] border border-retro-border-soft bg-retro-card px-3 py-3 text-sm text-retro-body",
              item.kind === "item" ? "cursor-grab active:cursor-grabbing" : ""
            )}
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
                      className="flex cursor-grab items-center justify-between gap-2 rounded-[10px] border border-retro-border-soft bg-retro-card-strong px-2.5 py-1.5 text-[13px] text-retro-strong active:cursor-grabbing"
                      title="Drag out to ungroup"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-words">{groupedItem.text}</p>
                        <div className="mt-1 flex w-full items-end justify-between gap-2">
                          <span>{renderEntryBadge(groupedItem.id)}</span>
                          <span className="inline-flex items-center gap-2">
                            <IconActionButton
                              label="Edit comment"
                              title="Edit comment"
                              className="h-7 w-7 rounded-[8px]"
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                onEdit(side, groupedItem.id);
                              }}
                              disabled={!canEdit(groupedItem.id)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2]">
                                <path d="m4 20 4-1 9.8-9.8a1.4 1.4 0 0 0 0-2L16.8 6a1.4 1.4 0 0 0-2 0L5 15.8 4 20Z" />
                                <path d="m13.5 7.5 3 3" />
                              </svg>
                            </IconActionButton>
                            <IconActionButton
                              label="Undo from group"
                              title="Undo from group"
                              className="h-7 w-7 rounded-[8px]"
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
                            </IconActionButton>
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </span>
            )}
            <div className="mt-1 flex w-full items-end justify-between gap-2">
              <span>{item.kind === "item" ? renderEntryBadge(item.id) : null}</span>
              <span className="inline-flex items-center gap-2">
                <span className="min-w-5 text-right text-xs text-retro-muted">{item.votes}</span>
                <IconActionButton
                  label="Upvote"
                  className={cn(
                    "h-[30px] w-[30px] rounded-[10px] leading-7",
                    item.voted ? "border-retro-border bg-retro-card-strong text-retro-body" : ""
                  )}
                  onClick={() => onToggleVote(side, item.id)}
                >
                  ↑
                </IconActionButton>
                {item.kind === "item" && canEdit(item.id) ? (
                  <IconActionButton
                    label="Edit"
                    className="h-[30px] w-[30px] rounded-[10px] leading-7"
                    onClick={() => onEdit(side, item.id)}
                  >
                    ✎
                  </IconActionButton>
                ) : null}
                {canRemove(item.id) ? (
                  <IconActionButton
                    label="Remove"
                    className="h-[30px] w-[30px] rounded-[10px] leading-7"
                    onClick={() => onRemove(side, item.id)}
                  >
                    ×
                  </IconActionButton>
                ) : null}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
