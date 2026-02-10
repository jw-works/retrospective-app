"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Moon, Share2, Sun } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildDiscussionQueue,
  sortEntries,
  type DiscussionTopic,
  type RetroEntry,
  type Side,
} from "@/lib/discussion";
import type { SessionStateResponse } from "@/lib/backend/types";
import { RetroColumn } from "@/components/retro/retro-column";
import {
  colorToneIndexFromSeed,
  initialsFromName,
  parseSessionCode,
  toRetroItems,
} from "@/lib/retro/utils";
import {
  addEntryToGroup,
  createEntry,
  createGroup,
  createSession,
  deleteEntry,
  getSessionState,
  joinSession,
  moveEntry,
  setNavigation,
  ungroupEntry,
  upsertHappiness,
  voteEntry,
  unvoteEntry,
} from "@/lib/retro/api";
import {
  clearStoredActiveSlug,
  clearStoredToken,
  getStoredActiveSlug,
  getStoredToken,
  setStoredActiveSlug,
  setStoredToken,
} from "@/lib/retro/session-storage";

// Tracks currently dragged object for grouping/moving interactions.
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

const THEME_KEY = "retro.theme";

// Main application orchestrator:
// - bootstraps/joins sessions,
// - polls shared state,
// - dispatches backend mutations,
// - renders setup, board, discussion, and happiness flows.
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteSlugFromUrl = parseSessionCode(searchParams.get("join") ?? "");
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [joinSessionCode, setJoinSessionCode] = useState("");
  const [joinParticipantName, setJoinParticipantName] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [sessionSlug, setSessionSlug] = useState("");
  const [participantToken, setParticipantToken] = useState("");
  const [sessionState, setSessionState] = useState<SessionStateResponse | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [wentRightInput, setWentRightInput] = useState("");
  const [wentWrongInput, setWentWrongInput] = useState("");
  const [wentRightItems, setWentRightItems] = useState<RetroEntry[]>([]);
  const [wentWrongItems, setWentWrongItems] = useState<RetroEntry[]>([]);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [pendingGroup, setPendingGroup] = useState<PendingGroup | null>(null);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [discussionMode, setDiscussionMode] = useState(false);
  const [discussionQueue, setDiscussionQueue] = useState<DiscussionTopic[]>([]);
  const [discussionIndex, setDiscussionIndex] = useState(0);
  const [happinessMode, setHappinessMode] = useState(false);
  const [happinessScore, setHappinessScore] = useState(7);
  const [happinessSubmitted, setHappinessSubmitted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const sessionId = sessionSlug || "SES-7K2P9M";

  const currentStage = sessionState
    ? sessionState.navigation.activeSection === "discussion"
      ? "discussion"
      : sessionState.navigation.activeSection === "happiness"
        ? "happinessCheck"
        : sessionState.navigation.activeSection === "done"
          ? "done"
          : "retro"
    : !discussionMode
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
    done: "Done",
  };
  const currentStageIndex = stageOrder.indexOf(currentStage);

  const sortedRight = useMemo(
    () => sortEntries(wentRightItems),
    [wentRightItems],
  );
  const sortedWrong = useMemo(
    () => sortEntries(wentWrongItems),
    [wentWrongItems],
  );
  const hasDiscussionItems = wentRightItems.length + wentWrongItems.length > 0;
  const currentDiscussion = discussionQueue[discussionIndex];
  const currentDiscussionEntryId = currentDiscussion?.id.split(":")[1] ?? "";
  const currentDiscussionSourceItems =
    currentDiscussion?.side === "right" ? wentRightItems : wentWrongItems;
  const currentDiscussionEntry = currentDiscussionSourceItems.find(
    (entry) => entry.id === currentDiscussionEntryId,
  );
  const isAdmin = sessionState?.viewer?.isAdmin ?? false;
  const viewerId = sessionState?.viewer?.id ?? "";
  const participantMap = useMemo(
    () =>
      new Map(
        (sessionState?.participants ?? []).map((participant) => [
          participant.id,
          participant,
        ]),
      ),
    [sessionState],
  );
  const entryAuthorMap = useMemo(
    () =>
      new Map(
        (sessionState?.entries ?? []).map((entry) => [
          entry.id,
          entry.authorParticipantId,
        ]),
      ),
    [sessionState],
  );
  const sessionEntryMap = useMemo(
    () =>
      new Map((sessionState?.entries ?? []).map((entry) => [entry.id, entry])),
    [sessionState],
  );
  const viewerName = sessionState?.viewer?.name ?? "";
  const currentUserInitials = useMemo(
    () =>
      initialsFromName(isSetupComplete ? viewerName || adminName : adminName),
    [adminName, isSetupComplete, viewerName],
  );
  const currentUserTone = useMemo(
    () =>
      colorToneIndexFromSeed(
        (sessionState?.viewer?.id ?? "") || viewerName || adminName || "user",
      ),
    [adminName, sessionState?.viewer?.id, viewerName],
  );
  const entryBadge = (entryId: string) => {
    const authorId = entryAuthorMap.get(entryId) ?? "";
    const authorName = participantMap.get(authorId)?.name ?? "";
    const tone = colorToneIndexFromSeed(authorId || entryId);
    return (
      <Avatar
        className={`identity-badge identity-tone-${tone} size-6 shrink-0 border`}
        title={authorName || "Unknown"}
      >
        <AvatarFallback className="bg-transparent text-[10px] font-semibold text-inherit">
          {initialsFromName(authorName)}
        </AvatarFallback>
      </Avatar>
    );
  };

  const canEnterRetro =
    teamName.trim().length > 0 && adminName.trim().length > 0;
  const canJoinSession =
    joinSessionCode.trim().length > 0 && joinParticipantName.trim().length > 0;
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

  // Normalizes server state into the local UI model.
  const applySessionState = useCallback((state: SessionStateResponse) => {
    setSessionState(state);
    setTeamName(state.session.title);
    const admin = state.participants.find((participant) => participant.isAdmin);
    if (admin) setAdminName(admin.name);
    const nextRight = toRetroItems(state.entries, state.groups, "went_right");
    const nextWrong = toRetroItems(state.entries, state.groups, "went_wrong");
    setWentRightItems(nextRight);
    setWentWrongItems(nextWrong);

    const queue = buildDiscussionQueue(nextRight, nextWrong);
    setDiscussionQueue(queue);
    if (queue.length > 0) {
      const targetId = state.navigation.discussionEntryId;
      const queueIndex = targetId
        ? queue.findIndex((topic) => topic.id === targetId)
        : 0;
      setDiscussionIndex(queueIndex >= 0 ? queueIndex : 0);
    } else {
      setDiscussionIndex(0);
    }

    setDiscussionMode(
      state.navigation.activeSection === "discussion" ||
        state.navigation.activeSection === "happiness",
    );
    setHappinessMode(
      state.navigation.activeSection === "happiness" ||
        state.navigation.activeSection === "done",
    );
  }, []);

  // Single read path used for initial load and polling refreshes.
  const loadSessionState = useCallback(
    async (slug: string, token: string) => {
      const state = await getSessionState(slug, token);
      applySessionState(state);
    },
    [applySessionState],
  );

  // Mutation helper that always refreshes canonical session state after writes.
  const runMutation = useCallback(
    async (mutation: () => Promise<void>) => {
      if (!sessionSlug || !participantToken)
        throw new Error("Missing session credentials");
      await mutation();
      await loadSessionState(sessionSlug, participantToken);
    },
    [loadSessionState, participantToken, sessionSlug],
  );

  // Clears in-memory and persisted credentials when session is finished/ended.
  const resetToCreateSession = useCallback(() => {
    if (sessionSlug) {
      clearStoredToken(sessionSlug);
    }
    clearStoredActiveSlug();
    setSessionSlug("");
    setParticipantToken("");
    setSessionState(null);
    setWentRightItems([]);
    setWentWrongItems([]);
    setDiscussionQueue([]);
    setDiscussionIndex(0);
    setDiscussionMode(false);
    setHappinessMode(false);
    setHappinessSubmitted(false);
    setIsSetupComplete(false);
    router.replace("/");
  }, [router, sessionSlug]);

  const endSession = useCallback(async () => {
    if (!isAdmin || !sessionSlug || !participantToken) return;
    try {
      await setNavigation(sessionSlug, participantToken, {
        activeSection: "done",
      });
      resetToCreateSession();
      setApiError(null);
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Unable to end session",
      );
    }
  }, [isAdmin, participantToken, resetToCreateSession, sessionSlug]);

  const copyInviteLink = useCallback(async () => {
    if (!sessionSlug) return;
    const invite = `${window.location.origin}/session/${sessionSlug}/join`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invite);
      } else {
        const input = document.createElement("input");
        input.value = invite;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1600);
      setApiError(null);
    } catch {
      setApiError(`Copy failed. Use this link: ${invite}`);
    }
  }, [sessionSlug]);

  useEffect(() => {
    if (!inviteSlugFromUrl) return;
    setJoinSessionCode(inviteSlugFromUrl);
  }, [inviteSlugFromUrl]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const initialTheme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const slug = getStoredActiveSlug();
    const targetSlug = inviteSlugFromUrl || slug;
    if (!targetSlug) return;
    const token = getStoredToken(targetSlug);
    if (!token) return;

    setSessionSlug(targetSlug);
    setParticipantToken(token);
    setIsSetupComplete(true);
    loadSessionState(targetSlug, token).catch((error: unknown) => {
      setApiError(
        error instanceof Error
          ? error.message
          : "Unable to restore previous session",
      );
    });
  }, [inviteSlugFromUrl, loadSessionState]);

  useEffect(() => {
    if (!sessionSlug || !participantToken || !isSetupComplete) return;
    const interval = setInterval(() => {
      loadSessionState(sessionSlug, participantToken).catch(() => {
        // Keep polling resilient; explicit action errors are shown in button handlers.
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isSetupComplete, loadSessionState, participantToken, sessionSlug]);

  useEffect(() => {
    if (!isSetupComplete) return;
    if (sessionState?.navigation.activeSection !== "done") return;
    resetToCreateSession();
  }, [
    isSetupComplete,
    resetToCreateSession,
    sessionState?.navigation.activeSection,
  ]);

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

  const joinExistingSession = useCallback(async () => {
    if (!canJoinSession) return;
    try {
      setJoinError(null);
      const slug = parseSessionCode(joinSessionCode);
      const payload = await joinSession(slug, {
        name: joinParticipantName.trim(),
      });
      setStoredActiveSlug(payload.sessionSlug);
      setStoredToken(payload.sessionSlug, payload.token);
      setSessionSlug(payload.sessionSlug);
      setParticipantToken(payload.token);
      setIsSetupComplete(true);
      setJoinError(null);
      await loadSessionState(payload.sessionSlug, payload.token);
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("session not found")) {
        setJoinError("Invalid session code. Please check the invite link or session ID.");
        return;
      }
      setJoinError(
        error instanceof Error ? error.message : "Unable to join session",
      );
    }
  }, [canJoinSession, joinParticipantName, joinSessionCode, loadSessionState]);

  const addStandaloneItem = (side: Side, text: string) => {
    const type = side === "right" ? "went_right" : "went_wrong";
    runMutation(() =>
      createEntry(sessionSlug, participantToken, { type, content: text }),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to create entry",
      );
    });
  };

  const toggleVote = (side: Side, id: string) => {
    const source = side === "right" ? wentRightItems : wentWrongItems;
    const target = source.find((item) => item.id === id);
    if (!target) return;

    if (target.kind === "group") {
      const groupedIds = target.items.map((item) => item.id);
      const votedEntryId = groupedIds.find(
        (entryId) => sessionEntryMap.get(entryId)?.votedByViewer,
      );
      const voteTargetId = votedEntryId ?? groupedIds[0];
      if (!voteTargetId) return;

      const action = votedEntryId
        ? () => unvoteEntry(sessionSlug, participantToken, voteTargetId)
        : () => voteEntry(sessionSlug, participantToken, voteTargetId);
      runMutation(action).catch((error: unknown) => {
        setApiError(
          error instanceof Error ? error.message : "Unable to update vote",
        );
      });
      return;
    }

    const action = target.voted
      ? () => unvoteEntry(sessionSlug, participantToken, id)
      : () => voteEntry(sessionSlug, participantToken, id);
    runMutation(action).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to update vote",
      );
    });
  };

  const removeItem = (side: Side, id: string) => {
    const source = side === "right" ? wentRightItems : wentWrongItems;
    const target = source.find((item) => item.id === id);
    if (!target) return;

    if (target.kind === "group") {
      runMutation(async () => {
        await Promise.all(
          target.items.map((item) =>
            ungroupEntry(sessionSlug, participantToken, target.id, item.id),
          ),
        );
      }).catch((error: unknown) => {
        setApiError(
          error instanceof Error ? error.message : "Unable to ungroup items",
        );
      });
      return;
    }

    const authorId = entryAuthorMap.get(id);
    if (!authorId) return;
    const canDelete = isAdmin || authorId === viewerId;
    if (!canDelete) {
      setApiError(
        "Only admins can delete all entries. Non-admins can delete only their own entries.",
      );
      return;
    }

    runMutation(() => deleteEntry(sessionSlug, participantToken, id)).catch(
      (error: unknown) => {
        setApiError(
          error instanceof Error ? error.message : "Unable to remove entry",
        );
      },
    );
  };

  const groupItemsInSide = (
    _side: Side,
    sourceId: string,
    targetId: string,
    groupName: string,
  ) => {
    runMutation(() =>
      createGroup(sessionSlug, participantToken, {
        sourceEntryId: sourceId,
        targetEntryId: targetId,
        name: groupName,
      }),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to create group",
      );
    });
  };

  const addItemToExistingGroup = (
    _side: Side,
    sourceId: string,
    targetGroupId: string,
  ) => {
    runMutation(() =>
      addEntryToGroup(sessionSlug, participantToken, targetGroupId, sourceId),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to add to group",
      );
    });
  };

  const moveItemAcrossSides = (
    sourceSide: Side,
    targetSide: Side,
    sourceId: string,
  ) => {
    if (sourceSide === targetSide) return;
    const nextType = targetSide === "right" ? "went_right" : "went_wrong";
    runMutation(() =>
      moveEntry(sessionSlug, participantToken, sourceId, nextType),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to move entry",
      );
    });
  };

  const extractGroupedItem = async (
    sourceSide: Side,
    groupId: string,
    itemId: string,
  ): Promise<string | null> => {
    const sourceItems =
      sourceSide === "right" ? wentRightItems : wentWrongItems;
    const targetGroup = sourceItems.find((entry) => entry.id === groupId);
    if (!targetGroup || targetGroup.kind !== "group") return null;
    const extracted = targetGroup.items.find((entry) => entry.id === itemId);
    if (!extracted) return null;

    await runMutation(() =>
      ungroupEntry(sessionSlug, participantToken, groupId, itemId),
    );
    return extracted.text;
  };

  const undoGroupedItem = (side: Side, groupId: string, itemId: string) => {
    void side;
    extractGroupedItem(side, groupId, itemId).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to ungroup item",
      );
    });
  };

  const handleDropOnItem = (targetSide: Side, targetId: string) => {
    if (!dragging) return;

    if (dragging.kind === "grouped-item") {
      extractGroupedItem(dragging.sourceSide, dragging.groupId, dragging.itemId)
        .then((text) => {
          if (!text) return;
          addStandaloneItem(targetSide, text);
        })
        .catch((error: unknown) => {
          setApiError(
            error instanceof Error
              ? error.message
              : "Unable to move grouped item",
          );
        });
      setDragging(null);
      return;
    }

    if (dragging.sourceSide === targetSide) {
      if (dragging.id === targetId) {
        setDragging(null);
        return;
      }

      const targetItems =
        targetSide === "right" ? wentRightItems : wentWrongItems;
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
    groupItemsInSide(
      pendingGroup.side,
      pendingGroup.sourceId,
      pendingGroup.targetId,
      nextName,
    );
    setPendingGroup(null);
    setGroupNameInput("");
  };

  const handleDropOnPanel = (targetSide: Side) => {
    if (!dragging) return;

    if (dragging.kind === "grouped-item") {
      extractGroupedItem(dragging.sourceSide, dragging.groupId, dragging.itemId)
        .then((text) => {
          if (!text) return;
          addStandaloneItem(targetSide, text);
        })
        .catch((error: unknown) => {
          setApiError(
            error instanceof Error
              ? error.message
              : "Unable to move grouped item",
          );
        });
      setDragging(null);
      return;
    }

    if (dragging.sourceSide === targetSide) return;
    moveItemAcrossSides(dragging.sourceSide, targetSide, dragging.id);
    setDragging(null);
  };

  const startDiscussion = () => {
    if (!isAdmin) {
      setApiError("Only the admin can start discussion.");
      return;
    }
    const queue = buildDiscussionQueue(wentRightItems, wentWrongItems);
    if (!queue.length) return;
    runMutation(() =>
      setNavigation(sessionSlug, participantToken, {
        activeSection: "discussion",
        discussionEntryId: queue[0]?.id ?? null,
      }),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to start discussion",
      );
    });
  };

  const nextDiscussion = () => {
    if (!isAdmin) return;
    if (discussionIndex >= discussionQueue.length - 1) return;
    const nextTopic = discussionQueue[discussionIndex + 1];
    runMutation(() =>
      setNavigation(sessionSlug, participantToken, {
        activeSection: "discussion",
        discussionEntryId: nextTopic?.id ?? null,
      }),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to move to next topic",
      );
    });
  };

  const previousDiscussion = () => {
    if (!isAdmin) return;
    if (discussionIndex === 0) return;
    const previousTopic = discussionQueue[discussionIndex - 1];
    runMutation(() =>
      setNavigation(sessionSlug, participantToken, {
        activeSection: "discussion",
        discussionEntryId: previousTopic?.id ?? null,
      }),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error
          ? error.message
          : "Unable to move to previous topic",
      );
    });
  };

  const finishDiscussion = () => {
    if (!isAdmin) return;
    runMutation(() =>
      setNavigation(sessionSlug, participantToken, {
        activeSection: "happiness",
        discussionEntryId: null,
      }),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error
          ? error.message
          : "Unable to move to happiness check",
      );
    });
  };

  return (
    <main className="mx-auto my-12 max-w-[1180px] px-7 max-[840px]:my-7">
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
            <DialogDescription>
              Choose a name for the merged card.
            </DialogDescription>
          </DialogHeader>
          <Input
            className="mt-4 block h-[42px] w-full rounded-[10px] border border-retro-border-soft bg-retro-card px-3 text-retro-strong placeholder:text-retro-subtle"
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

      <header className="mb-7 flex items-center justify-between text-sm text-retro-muted">
        {isSetupComplete ? (
          <div className="flex items-center gap-2">
            {stageOrder.map((stage, index) => {
              const isCurrent = index === currentStageIndex;
              const isDone = index < currentStageIndex;
              const isBlocked = index > currentStageIndex;

              return (
                <div key={stage} className="flex items-center gap-2">
                  <Badge
                    className={`inline-flex items-center rounded-full border px-3 py-2 text-xs ${
                      isCurrent
                        ? "border-retro-border bg-retro-card-hover text-retro-body"
                        : isDone
                          ? "border-retro-border bg-retro-surface-soft text-retro-body"
                          : "border-retro-border-soft bg-retro-card text-retro-subtle"
                    }`}
                  >
                    {stageLabel[stage]}
                  </Badge>
                  {index < stageOrder.length - 1 ? (
                    <span className="text-retro-subtle">›</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Badge className="inline-flex items-center gap-2 rounded-full border border-retro-border bg-retro-surface-soft px-3 py-2 text-xs text-retro-strong before:size-1.5 before:rounded-full before:bg-retro-dot before:content-['']">
              Session Launchpad
            </Badge>
            <span className="text-xs text-retro-subtle">
              Create your retrospective room
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle dark mode"
            className="grid size-[34px] place-items-center rounded-full border border-retro-border bg-retro-surface-soft text-retro-strong"
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </button>
          <Avatar
            className={`identity-badge identity-tone-${currentUserTone} size-[34px] border shadow-[0_10px_22px_rgba(0,0,0,0.07)]`}
          >
            <AvatarFallback className="bg-transparent text-[11px] font-medium text-inherit">
              {currentUserInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {!isSetupComplete ? (
        inviteSlugFromUrl ? (
          <section className="my-[14px] mb-[26px]">
            <div className="mx-auto max-w-[540px] overflow-hidden rounded-[20px] border border-retro-border-soft bg-retro-surface p-7 shadow-[0_24px_46px_rgba(0,0,0,0.06)]">
              <p className="text-xs tracking-[0.2em] text-retro-muted uppercase">
                Join Session
              </p>
              <h1 className="mt-2 text-[34px] leading-[1.1] font-medium text-retro-heading">
                Enter Your Name
              </h1>
              <p className="mt-2 text-sm text-retro-muted">
                You are joining session{" "}
                <span className="font-medium text-retro-strong">
                  {inviteSlugFromUrl}
                </span>
                .
              </p>
              <div className="mt-6">
                <Input
                  className="block h-[44px] w-full rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 text-retro-strong placeholder:text-retro-subtle"
                  placeholder="Your name"
                  value={joinParticipantName}
                  onChange={(event) => {
                    setJoinError(null);
                    setJoinParticipantName(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      joinExistingSession();
                    }
                  }}
                />
              </div>
              <div className="mt-6">
                <Button
                  type="button"
                  onClick={joinExistingSession}
                  disabled={!canJoinSession}
                >
                  Join Session
                </Button>
              </div>
              {joinError ? (
                <p className="mt-3 text-sm text-retro-danger">{joinError}</p>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="my-[14px] mb-[26px]">
            <div className="relative overflow-hidden rounded-[20px] border border-retro-border-soft bg-retro-surface p-7 shadow-[0_24px_46px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_10%_15%,rgba(255,255,255,0.32),rgba(255,255,255,0)_46%),radial-gradient(circle_at_90%_90%,rgba(255,255,255,0.24),rgba(255,255,255,0)_45%)] before:content-[''] dark:before:bg-none">
              <div className="relative z-10 grid grid-cols-[1.45fr_1fr] gap-6 max-[840px]:grid-cols-1">
                <section>
                  <p className="text-xs tracking-[0.2em] text-retro-muted uppercase">
                    Welcome
                  </p>
                  <h1 className="mt-2 text-[38px] leading-[1.05] font-medium text-retro-heading">
                    Create a New Retro Room
                  </h1>
                  <p className="mt-3 max-w-[45ch] text-sm text-retro-muted">
                    Give your session a team identity and assign the facilitator
                    before the board unlocks.
                  </p>

                  <div className="mt-6 grid gap-3">
                    <div>
                      <Label
                        htmlFor="team-name"
                        className="mb-1 block text-sm text-retro-strong"
                      >
                        Team Name
                      </Label>
                      <Input
                        id="team-name"
                        className="block h-[44px] w-full rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 text-retro-strong placeholder:text-retro-subtle"
                        placeholder="e.g. Product Engineering"
                        value={teamName}
                        onChange={(event) => setTeamName(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="admin-name"
                        className="mb-1 block text-sm text-retro-strong"
                      >
                        Facilitator Name
                      </Label>
                      <Input
                        id="admin-name"
                        className="block h-[44px] w-full rounded-[12px] border border-retro-border-soft bg-retro-card-strong px-3 text-retro-strong placeholder:text-retro-subtle"
                        placeholder="e.g. Alex Johnson"
                        value={adminName}
                        onChange={(event) => setAdminName(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <Button
                      type="button"
                      onClick={async () => {
                        if (!canEnterRetro) return;
                        try {
                          setApiError(null);
                          const payload = await createSession({
                            title: teamName.trim(),
                            adminName: adminName.trim(),
                          });
                          const slug = payload.session.slug;
                          setStoredActiveSlug(slug);
                          setStoredToken(slug, payload.token);
                          setSessionSlug(slug);
                          setParticipantToken(payload.token);
                          setIsSetupComplete(true);
                          await loadSessionState(slug, payload.token);
                        } catch (error) {
                          setApiError(
                            error instanceof Error
                              ? error.message
                              : "Unable to create session",
                          );
                        }
                      }}
                      disabled={!canEnterRetro}
                    >
                      Launch Retrospective
                    </Button>
                  </div>
                  {apiError ? (
                    <p className="mt-3 text-sm text-retro-danger">{apiError}</p>
                  ) : null}
                </section>

                <section className="rounded-[16px] border border-retro-border-soft bg-retro-surface-soft p-5">
                  <h3 className="m-0 text-base font-medium text-retro-strong">
                    Join Instead
                  </h3>
                  <p className="mt-2 text-xs text-retro-muted">
                    Got a shared session code? Join an existing retrospective
                    room.
                  </p>
                  <div className="mt-4 grid gap-2.5 rounded-[14px] border border-retro-border-soft bg-retro-card p-4">
                    <Input
                      className="block h-[40px] w-full rounded-[10px] border border-retro-border-soft bg-retro-card-hover px-3 text-sm text-retro-strong placeholder:text-retro-subtle"
                      placeholder="Session code or invite URL"
                      value={joinSessionCode}
                      onChange={(event) => {
                        setJoinError(null);
                        setJoinSessionCode(event.target.value);
                      }}
                    />
                    <Input
                      className="block h-[40px] w-full rounded-[10px] border border-retro-border-soft bg-retro-card-hover px-3 text-sm text-retro-strong placeholder:text-retro-subtle"
                      placeholder="Your name"
                      value={joinParticipantName}
                      onChange={(event) => {
                        setJoinError(null);
                        setJoinParticipantName(event.target.value);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canJoinSession}
                      onClick={joinExistingSession}
                    >
                      Join Session
                    </Button>
                  </div>
                  <div className="mt-4 rounded-[12px] border border-retro-border-soft bg-retro-surface-soft px-3 py-2 text-xs text-retro-muted">
                    Ask the admin to share the invite code from their session.
                  </div>
                  {joinError ? (
                    <p className="mt-3 text-sm text-retro-danger">{joinError}</p>
                  ) : null}
                </section>
              </div>
            </div>
          </section>
        )
      ) : (
        <>
          <section className="my-[14px] mb-[26px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="m-0 text-[34px] leading-[1.15] font-medium text-retro-heading">
                  {teamName.trim()} Retrospective
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-retro-muted">
                  <span className="rounded-[10px] border border-retro-border bg-retro-surface-soft px-2.5 py-1">
                    {sessionId}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-[10px] border border-retro-border bg-retro-surface-soft px-2.5 py-1 text-retro-body"
                    onClick={copyInviteLink}
                  >
                    <Share2 className="size-3.5" />
                    {inviteCopied ? "Copied" : "Copy invite link"}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!discussionMode ? (
                  <Button
                    type="button"
                    onClick={startDiscussion}
                    disabled={!hasDiscussionItems || !isAdmin}
                  >
                    Start Discussion
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isAdmin}
                    onClick={() => {
                      if (!isAdmin) return;
                      runMutation(() =>
                        setNavigation(sessionSlug, participantToken, {
                          activeSection: "retro",
                        }),
                      ).catch((error: unknown) => {
                        setApiError(
                          error instanceof Error
                            ? error.message
                            : "Unable to return to board",
                        );
                      });
                    }}
                  >
                    Back To Board
                  </Button>
                )}
                {isAdmin ? (
                  <Button type="button" variant="outline" onClick={endSession}>
                    End Session
                  </Button>
                ) : null}
              </div>
            </div>
            {apiError ? (
              <p className="mt-2 text-sm text-retro-danger">{apiError}</p>
            ) : null}
          </section>

          <section className="grid grid-cols-[1.2fr_1.2fr_0.9fr] items-stretch gap-[22px] max-[840px]:grid-cols-1">
            {discussionMode ? (
              <section className="relative col-span-2 min-h-[220px] overflow-hidden rounded-[18px] border border-retro-border-soft bg-retro-surface p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-white/0 before:content-[''] dark:before:bg-none max-[840px]:col-span-1 max-[840px]:min-h-[200px]">
                <div className="relative z-10 min-h-[320px]">
                  {happinessMode ? (
                    <div className="max-w-xl">
                      <p className="text-sm text-retro-muted">
                        Session complete
                      </p>
                      <h2 className="mt-2 text-[26px] leading-[1.2] font-medium text-retro-heading">
                        Happiness Check
                      </h2>
                      <p className="mt-2 text-sm text-retro-muted">
                        How do you feel about this retrospective session?
                      </p>
                      <div className="mt-5">
                        <div className="mb-2 flex items-center gap-2 text-sm text-retro-strong">
                          <span className="text-xl leading-none" aria-hidden>
                            {happinessMood.emoji}
                          </span>
                          <span>{happinessMood.label}</span>
                        </div>
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[happinessScore]}
                          onValueChange={(values) => setHappinessScore(values[0] ?? 7)}
                          className="w-full"
                        />
                        <div className="mt-1 flex justify-between text-xs text-retro-muted">
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
                        <p className="mt-5 text-sm text-retro-strong">
                          Thanks. Happiness score recorded.
                        </p>
                      ) : null}
                    </div>
                  ) : currentDiscussion ? (
                    <>
                      <p className="text-sm text-retro-muted">
                        {currentDiscussion.side === "right"
                          ? "What went right"
                          : "What went wrong"}{" "}
                        · {currentDiscussion.votes} votes
                      </p>
                      <div className="mt-2 flex items-start gap-3">
                        {currentDiscussion.kind === "item" && currentDiscussionEntryId
                          ? entryBadge(currentDiscussionEntryId)
                          : null}
                        <h2 className="text-[26px] leading-[1.2] font-medium text-retro-heading">
                          {currentDiscussion.title}
                        </h2>
                      </div>
                      {currentDiscussion.kind === "group" ? (
                        <ul className="mt-4 flex list-none flex-col gap-2 p-0">
                          {(currentDiscussionEntry?.kind === "group"
                            ? currentDiscussionEntry.items
                            : []
                          ).map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start gap-2 rounded-[12px] border border-retro-border-soft bg-retro-card px-3 py-2 text-sm text-retro-strong"
                            >
                              {entryBadge(item.id)}
                              <span>{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-retro-muted">
                      No topics available yet.
                    </p>
                  )}

                  {happinessMode && !happinessSubmitted ? (
                    <div className="absolute right-0 bottom-0">
                      <Button
                        type="button"
                        onClick={() => {
                          runMutation(() =>
                            upsertHappiness(
                              sessionSlug,
                              participantToken,
                              happinessScore,
                            ),
                          )
                            .then(() => setHappinessSubmitted(true))
                            .catch((error: unknown) => {
                              setApiError(
                                error instanceof Error
                                  ? error.message
                                  : "Unable to submit happiness",
                              );
                            });
                        }}
                      >
                        Submit Check
                      </Button>
                    </div>
                  ) : null}

                  {!happinessMode && currentDiscussion ? (
                    <>
                      <span className="absolute bottom-1 left-0 text-sm text-retro-muted">
                        {discussionIndex + 1}/{discussionQueue.length}
                      </span>
                      <div className="absolute right-0 bottom-0 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={previousDiscussion}
                          disabled={discussionIndex === 0 || !isAdmin}
                        >
                          Previous
                        </Button>
                        {discussionIndex >= discussionQueue.length - 1 ? (
                          <Button
                            type="button"
                            onClick={finishDiscussion}
                            disabled={!isAdmin}
                          >
                            Finish
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={nextDiscussion}
                            disabled={!isAdmin}
                          >
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
                <RetroColumn
                  side="right"
                  title="What went right"
                  inputValue={wentRightInput}
                  onInputChange={setWentRightInput}
                  onAdd={addWentRight}
                  items={sortedRight}
                  onDropPanel={handleDropOnPanel}
                  onDropItem={handleDropOnItem}
                  onDragStartEntry={(side, id, dataTransfer) => {
                    dataTransfer.setData("text/plain", id);
                    dataTransfer.effectAllowed = "move";
                    setDragging({ sourceSide: side, kind: "entry-item", id });
                  }}
                  onDragStartGrouped={(side, groupId, itemId, dataTransfer) => {
                    dataTransfer.setData("text/plain", itemId);
                    dataTransfer.effectAllowed = "move";
                    setDragging({
                      sourceSide: side,
                      kind: "grouped-item",
                      groupId,
                      itemId,
                    });
                  }}
                  onDragEnd={() => setDragging(null)}
                  onToggleVote={toggleVote}
                  onRemove={removeItem}
                  canRemove={(id) =>
                    isAdmin || entryAuthorMap.get(id) === viewerId
                  }
                  onUndoGroupedItem={undoGroupedItem}
                  renderEntryBadge={entryBadge}
                />

                <RetroColumn
                  side="wrong"
                  title="What went wrong"
                  inputValue={wentWrongInput}
                  onInputChange={setWentWrongInput}
                  onAdd={addWentWrong}
                  items={sortedWrong}
                  onDropPanel={handleDropOnPanel}
                  onDropItem={handleDropOnItem}
                  onDragStartEntry={(side, id, dataTransfer) => {
                    dataTransfer.setData("text/plain", id);
                    dataTransfer.effectAllowed = "move";
                    setDragging({ sourceSide: side, kind: "entry-item", id });
                  }}
                  onDragStartGrouped={(side, groupId, itemId, dataTransfer) => {
                    dataTransfer.setData("text/plain", itemId);
                    dataTransfer.effectAllowed = "move";
                    setDragging({
                      sourceSide: side,
                      kind: "grouped-item",
                      groupId,
                      itemId,
                    });
                  }}
                  onDragEnd={() => setDragging(null)}
                  onToggleVote={toggleVote}
                  onRemove={removeItem}
                  canRemove={(id) =>
                    isAdmin || entryAuthorMap.get(id) === viewerId
                  }
                  onUndoGroupedItem={undoGroupedItem}
                  renderEntryBadge={entryBadge}
                />
              </>
            )}

            <aside className="flex flex-col gap-4">
              <section className="relative overflow-hidden rounded-2xl border border-retro-border-soft bg-retro-surface p-[18px] shadow-[0_18px_38px_rgba(0,0,0,0.05)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/40 before:to-white/0 before:content-[''] dark:before:bg-none">
                <div className="relative z-10">
                  <h3 className="m-0 text-base font-medium text-retro-strong">
                    Joinees List
                  </h3>
                  <ul
                    aria-label="Joinees list"
                    className="mt-3 flex list-none flex-col gap-2.5 p-0"
                  >
                    {(sessionState?.participants ?? []).map((person) => (
                      <li
                        key={person.id}
                        className="flex items-center justify-between gap-3 rounded-[14px] border border-retro-border-soft bg-retro-card px-3 py-3"
                      >
                        <span className="inline-flex items-center gap-2.5 text-sm text-retro-body">
                          <Avatar
                            aria-hidden
                            className={`identity-badge identity-tone-${colorToneIndexFromSeed(person.id)} size-[24px] border`}
                          >
                            <AvatarFallback className="bg-transparent text-[10px] font-semibold text-inherit">
                              {initialsFromName(person.name)}
                            </AvatarFallback>
                          </Avatar>
                          {person.name}
                        </span>
                        {person.isAdmin ? (
                          <span className="text-xs text-retro-muted">
                            admin
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
