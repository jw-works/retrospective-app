import type { ReactNode } from "react";
import { RetroColumn } from "@/components/retro/retro-column";
import type { RetroEntry, Side } from "@/lib/discussion";

type BoardStageProps = {
  sortedRight: RetroEntry[];
  sortedWrong: RetroEntry[];
  wentRightInput: string;
  wentWrongInput: string;
  onWentRightInputChange: (value: string) => void;
  onWentWrongInputChange: (value: string) => void;
  onAddWentRight: () => void;
  onAddWentWrong: () => void;
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
  entryBadge: (entryId: string, size?: "sm" | "md") => ReactNode;
};

export function BoardStage({
  sortedRight,
  sortedWrong,
  wentRightInput,
  wentWrongInput,
  onWentRightInputChange,
  onWentWrongInputChange,
  onAddWentRight,
  onAddWentWrong,
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
  entryBadge,
}: BoardStageProps) {
  return (
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
  );
}
