"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  buildDiscussionQueue,
  sortEntries,
  type DiscussionTopic,
  type GroupEntry,
  type ItemEntry,
  type RetroEntry,
  type Side
} from "@/lib/discussion";

const people = [
  { name: "Annabel", online: true },
  { name: "Mo", online: true },
  { name: "Priya", online: false },
  { name: "Sam", online: false }
];

type DragState = {
  sourceSide: Side;
} & (
  | {
      kind: "entry-item";
      id: string;
    }
  | {
      kind: "grouped-item";
      groupId: string;
      itemId: string;
    }
);

type PendingGroup = {
  side: Side;
  sourceId: string;
  targetId: string;
};

const seededRight: RetroEntry[] = [
  {
    kind: "item",
    id: "right-1",
    text: "Release shipped on time, idk whats happening but its very sad to see teams not coordinating",
    votes: 2,
    voted: false,
    ts: Date.now() - 300000
  },
  {
    kind: "item",
    id: "right-2",
    text: "Support tickets down 18%",
    votes: 1,
    voted: false,
    ts: Date.now() - 240000
  },
  {
    kind: "item",
    id: "right-3",
    text: "Faster code reviews",
    votes: 0,
    voted: false,
    ts: Date.now() - 180000
  }
];

const seededWrong: RetroEntry[] = [
  {
    kind: "item",
    id: "wrong-1",
    text: "Build flakiness on CI",
    votes: 3,
    voted: false,
    ts: Date.now() - 360000
  },
  {
    kind: "item",
    id: "wrong-2",
    text: "Late scope changes",
    votes: 1,
    voted: false,
    ts: Date.now() - 200000
  },
  {
    kind: "item",
    id: "wrong-3",
    text: "Missing handover docs",
    votes: 0,
    voted: false,
    ts: Date.now() - 120000
  }
];

export default function Home() {
  const [wentRightInput, setWentRightInput] = useState("");
  const [wentWrongInput, setWentWrongInput] = useState("");
  const [wentRightItems, setWentRightItems] = useState<RetroEntry[]>(seededRight);
  const [wentWrongItems, setWentWrongItems] = useState<RetroEntry[]>(seededWrong);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [pendingGroup, setPendingGroup] = useState<PendingGroup | null>(null);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [discussionMode, setDiscussionMode] = useState(false);
  const [discussionQueue, setDiscussionQueue] = useState<DiscussionTopic[]>([]);
  const [discussionIndex, setDiscussionIndex] = useState(0);
  const [happinessMode, setHappinessMode] = useState(false);
  const [happinessScore, setHappinessScore] = useState(7);
  const [happinessSubmitted, setHappinessSubmitted] = useState(false);

  const currentStage = !discussionMode
    ? "retro"
    : happinessMode
      ? happinessSubmitted
        ? "done"
        : "happinessCheck"
      : "discussion";
  const stageOrder = ["retro", "discussion", "happinessCheck", "done"] as const;
  const stageLabel: Record<(typeof stageOrder)[number], string> = {
    retro: "Retro",
    discussion: "Discussion",
    happinessCheck: "Happiness Check",
    done: "Done"
  };
  const currentStageIndex = stageOrder.indexOf(currentStage);

  const sortedRight = useMemo(() => sortEntries(wentRightItems), [wentRightItems]);
  const sortedWrong = useMemo(() => sortEntries(wentWrongItems), [wentWrongItems]);
  const hasDiscussionItems = wentRightItems.length + wentWrongItems.length > 0;
  const currentDiscussion = discussionQueue[discussionIndex];
  const happinessMood =
    happinessScore <= 2
      ? { emoji: "😞", label: "Very low" }
      : happinessScore <= 4
        ? { emoji: "🙁", label: "Low" }
        : happinessScore <= 5
          ? { emoji: "😐", label: "Okay" }
        : happinessScore <= 8
          ? { emoji: "🙂", label: "Good" }
            : { emoji: "😄", label: "Great" };

  const addWentRight = () => {
    const next = wentRightInput.trim();
    if (!next) return;
    addStandaloneItem("right", next);
    setWentRightInput("");
  };

  const addWentWrong = () => {
    const next = wentWrongInput.trim();
    if (!next) return;
    addStandaloneItem("wrong", next);
    setWentWrongInput("");
  };

  const addStandaloneItem = (side: Side, text: string) => {
    const nextItem: ItemEntry = {
      kind: "item",
      id: `${side}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      votes: 0,
      voted: false,
      ts: Date.now()
    };
    if (side === "right") setWentRightItems((current) => [...current, nextItem]);
    if (side === "wrong") setWentWrongItems((current) => [...current, nextItem]);
  };

  const toggleVote = (side: Side, id: string) => {
    const update = (items: RetroEntry[]) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const voted = !item.voted;
        return { ...item, voted, votes: Math.max(0, item.votes + (voted ? 1 : -1)) };
      });

    if (side === "right") setWentRightItems((current) => update(current));
    if (side === "wrong") setWentWrongItems((current) => update(current));
  };

  const removeItem = (side: Side, id: string) => {
    const applyRemove = (items: RetroEntry[]) => {
      const target = items.find((item) => item.id === id);
      if (!target) return items;

      if (target.kind === "item") {
        return items.filter((item) => item.id !== id);
      }

      const restoredItems: ItemEntry[] = target.items.map((groupedItem) => ({
        kind: "item",
        id: `${side}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: groupedItem.text,
        votes: 0,
        voted: false,
        ts: Date.now()
      }));

      const withoutGroup = items.filter((item) => item.id !== id);
      return [...withoutGroup, ...restoredItems];
    };

    if (side === "right") setWentRightItems((current) => applyRemove(current));
    if (side === "wrong") setWentWrongItems((current) => applyRemove(current));
  };

  const groupItemsInSide = (side: Side, sourceId: string, targetId: string, groupName: string) => {
    const applyGroup = (items: RetroEntry[]) => {
      const sourceEntry = items.find((item) => item.id === sourceId);
      const targetEntry = items.find((item) => item.id === targetId);

      if (!sourceEntry || !targetEntry) return items;
      if (sourceEntry.kind !== "item" || targetEntry.kind !== "item") return items;

      const nextGroup: GroupEntry = {
        kind: "group",
        id: `group-${Date.now()}`,
        name: groupName,
        items: [
          { id: targetEntry.id, text: targetEntry.text },
          { id: sourceEntry.id, text: sourceEntry.text }
        ],
        votes: 0,
        voted: false,
        ts: Date.now()
      };

      const filtered = items.filter((item) => item.id !== sourceId && item.id !== targetId);
      return [...filtered, nextGroup];
    };

    if (side === "right") setWentRightItems((current) => applyGroup(current));
    if (side === "wrong") setWentWrongItems((current) => applyGroup(current));
  };

  const addItemToExistingGroup = (side: Side, sourceId: string, targetGroupId: string) => {
    const applyAdd = (items: RetroEntry[]) => {
      const sourceEntry = items.find((item) => item.id === sourceId);
      const targetEntry = items.find((item) => item.id === targetGroupId);

      if (!sourceEntry || !targetEntry) return items;
      if (sourceEntry.kind !== "item" || targetEntry.kind !== "group") return items;

      const filtered = items.filter((item) => item.id !== sourceId);
      return filtered.map((item) => {
        if (item.id !== targetGroupId || item.kind !== "group") return item;
        return {
          ...item,
          items: [...item.items, { id: sourceEntry.id, text: sourceEntry.text }]
        };
      });
    };

    if (side === "right") setWentRightItems((current) => applyAdd(current));
    if (side === "wrong") setWentWrongItems((current) => applyAdd(current));
  };

  const moveItemAcrossSides = (sourceSide: Side, targetSide: Side, sourceId: string) => {
    const sourceItems = sourceSide === "right" ? wentRightItems : wentWrongItems;
    const moved = sourceItems.find((entry) => entry.id === sourceId);
    if (!moved || moved.kind !== "item") return;

    if (sourceSide === "right") {
      setWentRightItems((current) => current.filter((entry) => entry.id !== sourceId));
    } else {
      setWentWrongItems((current) => current.filter((entry) => entry.id !== sourceId));
    }

    addStandaloneItem(targetSide, moved.text);
  };

  const extractGroupedItem = (sourceSide: Side, groupId: string, itemId: string): string | null => {
    const sourceItems = sourceSide === "right" ? wentRightItems : wentWrongItems;
    const targetGroup = sourceItems.find((entry) => entry.id === groupId);
    if (!targetGroup || targetGroup.kind !== "group") return null;

    const extracted = targetGroup.items.find((entry) => entry.id === itemId);
    if (!extracted) return null;

    const remainingItems = targetGroup.items.filter((entry) => entry.id !== itemId);

    const nextEntries: RetroEntry[] = [];
    for (const entry of sourceItems) {
      if (entry.id !== groupId) {
        nextEntries.push(entry);
        continue;
      }

      if (remainingItems.length >= 2) {
        nextEntries.push({ ...entry, items: remainingItems });
        continue;
      }

      if (remainingItems.length === 1) {
        nextEntries.push({
          kind: "item",
          id: `${sourceSide}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: remainingItems[0].text,
          votes: 0,
          voted: false,
          ts: Date.now()
        });
      }
    }

    if (sourceSide === "right") setWentRightItems(nextEntries);
    if (sourceSide === "wrong") setWentWrongItems(nextEntries);

    return extracted.text;
  };

  const undoGroupedItem = (side: Side, groupId: string, itemId: string) => {
    const text = extractGroupedItem(side, groupId, itemId);
    if (!text) return;
    addStandaloneItem(side, text);
  };

  const handleDropOnItem = (targetSide: Side, targetId: string) => {
    if (!dragging) return;

    if (dragging.kind === "grouped-item") {
      const text = extractGroupedItem(dragging.sourceSide, dragging.groupId, dragging.itemId);
      if (!text) {
        setDragging(null);
        return;
      }
      addStandaloneItem(targetSide, text);
      setDragging(null);
      return;
    }

    if (dragging.sourceSide === targetSide) {
      if (dragging.id === targetId) {
        setDragging(null);
        return;
      }

      const targetItems = targetSide === "right" ? wentRightItems : wentWrongItems;
      const targetEntry = targetItems.find((entry) => entry.id === targetId);
      if (targetEntry?.kind === "group") {
        addItemToExistingGroup(targetSide, dragging.id, targetId);
        setDragging(null);
        return;
      }

      setPendingGroup({ side: targetSide, sourceId: dragging.id, targetId });
      setGroupNameInput("New group");
      setDragging(null);
      return;
    }

    moveItemAcrossSides(dragging.sourceSide, targetSide, dragging.id);
    setDragging(null);
  };

  const createPendingGroup = () => {
    if (!pendingGroup) return;
    const nextName = groupNameInput.trim();
    if (!nextName) return;
    groupItemsInSide(pendingGroup.side, pendingGroup.sourceId, pendingGroup.targetId, nextName);
    setPendingGroup(null);
    setGroupNameInput("");
  };

  const handleDropOnPanel = (targetSide: Side) => {
    if (!dragging) return;

    if (dragging.kind === "grouped-item") {
      const text = extractGroupedItem(dragging.sourceSide, dragging.groupId, dragging.itemId);
      if (!text) {
        setDragging(null);
        return;
      }
      addStandaloneItem(targetSide, text);
      setDragging(null);
      return;
    }

    if (dragging.sourceSide === targetSide) return;

    moveItemAcrossSides(dragging.sourceSide, targetSide, dragging.id);
    setDragging(null);
  };

  const startDiscussion = () => {
    const queue = buildDiscussionQueue(wentRightItems, wentWrongItems);
    if (!queue.length) return;
    setDiscussionQueue(queue);
    setDiscussionIndex(0);
    setHappinessMode(false);
    setHappinessSubmitted(false);
    setDiscussionMode(true);
  };

  const nextDiscussion = () => {
    if (discussionIndex >= discussionQueue.length - 1) return;
    setDiscussionIndex((index) => index + 1);
  };

  const previousDiscussion = () => {
    if (discussionIndex === 0) return;
    setDiscussionIndex((index) => index - 1);
  };

  const finishDiscussion = () => {
    setHappinessMode(true);
  };

  return (
    <main className="mx-auto my-12 max-w-[980px] px-7 max-[840px]:my-7">
      <Dialog
        open={Boolean(pendingGroup)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingGroup(null);
            setGroupNameInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name New Group</DialogTitle>
            <DialogDescription>Choose a name for the merged card.</DialogDescription>
          </DialogHeader>
          <input
            className="mt-4 block h-[42px] w-full rounded-[10px] border border-black/6 bg-white/45 px-3 text-[#565b62] placeholder:text-[#9aa0a6]"
            type="text"
            placeholder="Group name"
            value={groupNameInput}
            onChange={(event) => setGroupNameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                createPendingGroup();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingGroup(null);
                setGroupNameInput("");
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={createPendingGroup}>
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="mb-7 flex items-center justify-between text-sm text-[#6f757d]">
        <div className="flex items-center gap-2">
          {stageOrder.map((stage, index) => {
            const isCurrent = index === currentStageIndex;
            const isDone = index < currentStageIndex;
            const isBlocked = index > currentStageIndex;

            return (
              <div key={stage} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-2 text-xs ${
                    isCurrent
                      ? "border-black/10 bg-white/55 text-[#4f545a]"
                      : isDone
                        ? "border-black/8 bg-white/35 text-[#6a7078]"
                        : "border-black/6 bg-white/20 text-[#9aa0a6]"
                  }`}
                >
                  {stageLabel[stage]}
                </span>
                {index < stageOrder.length - 1 ? <span className="text-[#9aa0a6]">›</span> : null}
              </div>
            );
          })}
        </div>
        <span
          aria-hidden
          className="size-[34px] rounded-full border border-black/6 bg-gradient-to-b from-[#f7f7f8] to-[#dedfe2] shadow-[0_10px_22px_rgba(0,0,0,0.07)]"
        />
      </header>

      <section className="my-[14px] mb-[26px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 text-[34px] leading-[1.15] font-medium text-[#3a3d41]">Team Retrospective</h1>
          {!discussionMode ? (
            <Button type="button" onClick={startDiscussion} disabled={!hasDiscussionItems}>
              Start Discussion
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setDiscussionMode(false)}>
                Back To Board
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-[1.2fr_1.2fr_0.9fr] items-stretch gap-[22px] max-[840px]:grid-cols-1">
        {discussionMode ? (
          <section className="relative col-span-2 min-h-[220px] overflow-hidden rounded-[18px] border border-black/6 bg-[#eeeeef] p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-[''] max-[840px]:col-span-1 max-[840px]:min-h-[200px]">
            <div className="relative z-10 min-h-[320px]">
              {happinessMode ? (
                <div className="max-w-xl">
                  <p className="text-sm text-[#7a8088]">Session complete</p>
                  <h2 className="mt-2 text-[26px] leading-[1.2] font-medium text-[#3a3d41]">Happiness Check</h2>
                  <p className="mt-2 text-sm text-[#6f757d]">
                    How do you feel about this retrospective session?
                  </p>
                  <div className="mt-5">
                    <div className="mb-2 flex items-center gap-2 text-sm text-[#565b62]">
                      <span className="text-xl leading-none" aria-hidden>
                        {happinessMood.emoji}
                      </span>
                      <span>{happinessMood.label}</span>
                    </div>
                    <input
                      id="happiness"
                      type="range"
                      min={1}
                      max={10}
                      value={happinessScore}
                      onChange={(event) => setHappinessScore(Number(event.target.value))}
                      className="w-full accent-neutral-700"
                    />
                    <div className="mt-1 flex justify-between text-xs text-[#7a8088]">
                      <span>1</span>
                      <span>2</span>
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                      <span>6</span>
                      <span>7</span>
                      <span>8</span>
                      <span>9</span>
                      <span>10</span>
                    </div>
                  </div>
                  {happinessSubmitted ? (
                    <p className="mt-5 text-sm text-[#565b62]">Thanks. Happiness score recorded.</p>
                  ) : null}
                </div>
              ) : currentDiscussion ? (
                <>
                  <p className="text-sm text-[#7a8088]">
                    {currentDiscussion.side === "right" ? "What went right" : "What went wrong"} ·{" "}
                    {currentDiscussion.votes} votes
                  </p>
                  <h2 className="mt-2 text-[26px] leading-[1.2] font-medium text-[#3a3d41]">
                    {currentDiscussion.title}
                  </h2>
                  {currentDiscussion.kind === "group" ? (
                    <ul className="mt-4 flex list-none flex-col gap-2 p-0">
                      {currentDiscussion.items.map((item, index) => (
                        <li
                          key={`${currentDiscussion.id}-${index}`}
                          className="rounded-[12px] border border-black/6 bg-white/45 px-3 py-2 text-sm text-[#565b62]"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-[#7a8088]">No topics available yet.</p>
              )}

              {happinessMode && !happinessSubmitted ? (
                <div className="absolute right-0 bottom-0">
                  <Button type="button" onClick={() => setHappinessSubmitted(true)}>
                    Submit Check
                  </Button>
                </div>
              ) : null}

              {!happinessMode && currentDiscussion ? (
                <>
                  <span className="absolute bottom-1 left-0 text-sm text-[#7a8088]">
                    {discussionIndex + 1}/{discussionQueue.length}
                  </span>
                  <div className="absolute right-0 bottom-0 flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={previousDiscussion} disabled={discussionIndex === 0}>
                    Previous
                  </Button>
                  {discussionIndex >= discussionQueue.length - 1 ? (
                    <Button type="button" onClick={finishDiscussion}>
                      Finish
                    </Button>
                  ) : (
                    <Button type="button" onClick={nextDiscussion}>
                      Next Topic
                    </Button>
                  )}
                  </div>
                </>
              ) : null}
            </div>
          </section>
        ) : (
          <>
        <section
          className="relative min-h-[220px] overflow-hidden rounded-[18px] border border-black/6 bg-[#eeeeef] p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-[''] max-[840px]:min-h-[200px]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleDropOnPanel("right");
          }}
        >
          <h2 className="m-0 text-lg font-medium text-[#51555b]">What went right</h2>
          <div className="mt-[14px]">
            <div className="relative">
              <input
                className="block h-[42px] w-full rounded-[10px] border border-black/6 bg-white/45 px-3 pr-11 text-[#565b62] placeholder:text-[#9aa0a6]"
                type="text"
                placeholder="Type and press enter"
                value={wentRightInput}
                onChange={(event) => setWentRightInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addWentRight();
                  }
                }}
              />
              <button
                type="button"
                aria-label="Add"
                onClick={addWentRight}
                className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-[10px] border border-black/6 bg-white/55 text-[#6a7078] active:translate-y-[calc(-50%+1px)]"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2.2]">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
          <ul className="mt-[14px] flex list-none flex-col gap-2.5 p-0" aria-label="What went right list">
            {sortedRight.map((item) => (
              <li
                key={item.id}
                draggable={item.kind === "item"}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", item.id);
                  event.dataTransfer.effectAllowed = "move";
                  setDragging({ sourceSide: "right", kind: "entry-item", id: item.id });
                }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleDropOnItem("right", item.id);
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
                            setDragging({
                              sourceSide: "right",
                              kind: "grouped-item",
                              groupId: item.id,
                              itemId: groupedItem.id
                            });
                          }}
                          onDragEnd={() => setDragging(null)}
                          className="flex cursor-grab items-center justify-between gap-2 rounded-[10px] border border-black/6 bg-white/50 px-2.5 py-1.5 text-[13px] text-[#565b62] active:cursor-grabbing"
                          title="Drag out to ungroup"
                        >
                          <span>{groupedItem.text}</span>
                          <button
                            type="button"
                            aria-label="Undo from group"
                            title="Undo from group"
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border border-black/6 bg-white/65 text-[#6a7078]"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              undoGroupedItem("right", item.id, groupedItem.id);
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
                <span className="ml-auto inline-flex items-center gap-2">
                  <span className="min-w-5 text-right text-xs text-[#7a8088]">{item.votes}</span>
                  <button
                    type="button"
                    aria-label="Upvote"
                    aria-pressed={item.voted}
                    onClick={() => toggleVote("right", item.id)}
                    className={`h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078] transition ${
                      item.voted ? "border-black/12 bg-[#d2d4d8] text-[#4f545a]" : ""
                    }`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeItem("right", item.id)}
                    className="h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078]"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="relative min-h-[220px] overflow-hidden rounded-[18px] border border-black/6 bg-[#eeeeef] p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-[''] max-[840px]:min-h-[200px]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleDropOnPanel("wrong");
          }}
        >
          <h2 className="m-0 text-lg font-medium text-[#51555b]">What went wrong</h2>
          <div className="mt-[14px]">
            <div className="relative">
              <input
                className="block h-[42px] w-full rounded-[10px] border border-black/6 bg-white/45 px-3 pr-11 text-[#565b62] placeholder:text-[#9aa0a6]"
                type="text"
                placeholder="Type and press enter"
                value={wentWrongInput}
                onChange={(event) => setWentWrongInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addWentWrong();
                  }
                }}
              />
              <button
                type="button"
                aria-label="Add"
                onClick={addWentWrong}
                className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-[10px] border border-black/6 bg-white/55 text-[#6a7078] active:translate-y-[calc(-50%+1px)]"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2.2]">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
          <ul className="mt-[14px] flex list-none flex-col gap-2.5 p-0" aria-label="What went wrong list">
            {sortedWrong.map((item) => (
              <li
                key={item.id}
                draggable={item.kind === "item"}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", item.id);
                  event.dataTransfer.effectAllowed = "move";
                  setDragging({ sourceSide: "wrong", kind: "entry-item", id: item.id });
                }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleDropOnItem("wrong", item.id);
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
                            setDragging({
                              sourceSide: "wrong",
                              kind: "grouped-item",
                              groupId: item.id,
                              itemId: groupedItem.id
                            });
                          }}
                          onDragEnd={() => setDragging(null)}
                          className="flex cursor-grab items-center justify-between gap-2 rounded-[10px] border border-black/6 bg-white/50 px-2.5 py-1.5 text-[13px] text-[#565b62] active:cursor-grabbing"
                          title="Drag out to ungroup"
                        >
                          <span>{groupedItem.text}</span>
                          <button
                            type="button"
                            aria-label="Undo from group"
                            title="Undo from group"
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border border-black/6 bg-white/65 text-[#6a7078]"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              undoGroupedItem("wrong", item.id, groupedItem.id);
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
                <span className="ml-auto inline-flex items-center gap-2">
                  <span className="min-w-5 text-right text-xs text-[#7a8088]">{item.votes}</span>
                  <button
                    type="button"
                    aria-label="Upvote"
                    aria-pressed={item.voted}
                    onClick={() => toggleVote("wrong", item.id)}
                    className={`h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078] transition ${
                      item.voted ? "border-black/12 bg-[#d2d4d8] text-[#4f545a]" : ""
                    }`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeItem("wrong", item.id)}
                    className="h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078]"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
          </>
        )}

        <aside className="flex flex-col gap-4">
          <section className="relative overflow-hidden rounded-2xl border border-black/6 bg-[#eeeeef] p-[18px] shadow-[0_18px_38px_rgba(0,0,0,0.05)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-['']">
            <div className="relative z-10">
              <h3 className="m-0 text-base font-medium text-[#565b62]">People online</h3>
              <p className="mt-2 text-sm text-[#7a8088]">8 available</p>
              <ul aria-label="People online" className="mt-[14px] flex list-none flex-col gap-2.5 p-0">
                {people.map((person) => (
                  <li
                    key={person.name}
                    className="flex items-center justify-between gap-3 rounded-[14px] border border-black/6 bg-white/28 px-3 py-3"
                  >
                    <span className="inline-flex items-center gap-2.5 text-sm text-[#4f545a]">
                      <span
                        aria-hidden
                        className={`size-[14px] rounded-full ${person.online ? "bg-[#34c759]" : "bg-[#c9ccd1]"}`}
                      />
                      {person.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
