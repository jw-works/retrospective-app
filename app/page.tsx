"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  buildDiscussionQueue,
  sortEntries,
  type DiscussionTopic,
  type RetroEntry,
  type Side,
} from "@/lib/discussion";
import type { SessionStateResponse } from "@/lib/backend/types";
import { AppShellHeader } from "@/components/retro/app-shell-header";
import { EditCommentDialog } from "@/components/retro/edit-comment-dialog";
import { GroupNameDialog } from "@/components/retro/group-name-dialog";
import { SessionScreen } from "@/components/retro/session-screen";
import { SetupScreen } from "@/components/retro/setup-screen";
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
  deleteActionItem,
  getSessionState,
  joinSession,
  moveEntry,
  createActionItem,
  setNavigation,
  ungroupEntry,
  updateEntry,
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

type PendingEdit = {
  entryId: string;
};

const THEME_KEY = "retro.theme";
const topicToEntryId = (topicId: string) => topicId.split(":")[1] ?? topicId;

// Main application orchestrator:
// - bootstraps/joins sessions,
// - polls shared state,
// - dispatches backend mutations,
// - renders setup, board, discussion, and happiness flows.
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteSlugFromUrl = parseSessionCode(searchParams.get("join") ?? "");
  const [isSetupComplete, setIsSetupComplete] = useState(() => {
    if (typeof window === "undefined") return false;
    const targetSlug = inviteSlugFromUrl || getStoredActiveSlug();
    if (!targetSlug) return false;
    return Boolean(getStoredToken(targetSlug));
  });
  const [teamName, setTeamName] = useState("");
  const [sprintLabel, setSprintLabel] = useState("");
  const [voteLimitInput, setVoteLimitInput] = useState("5");
  const [adminName, setAdminName] = useState("");
  const [joinSessionCode, setJoinSessionCode] = useState(() => inviteSlugFromUrl);
  const [joinParticipantName, setJoinParticipantName] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [sessionSlug, setSessionSlug] = useState(() => {
    if (typeof window === "undefined") return "";
    return inviteSlugFromUrl || getStoredActiveSlug() || "";
  });
  const [participantToken, setParticipantToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const targetSlug = inviteSlugFromUrl || getStoredActiveSlug();
    if (!targetSlug) return "";
    return getStoredToken(targetSlug) || "";
  });
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
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [editContentInput, setEditContentInput] = useState("");
  const [discussionMode, setDiscussionMode] = useState(false);
  const [discussionQueue, setDiscussionQueue] = useState<DiscussionTopic[]>([]);
  const [discussionIndex, setDiscussionIndex] = useState(0);
  const [happinessMode, setHappinessMode] = useState(false);
  const [happinessScore, setHappinessScore] = useState(7);
  const [happinessSubmitted, setHappinessSubmitted] = useState(false);
  const [actionItemInput, setActionItemInput] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const sessionId = sessionSlug || "SES-7K2P9M";
  const activeSprintLabel = sessionState?.session.sprintLabel?.trim() || sprintLabel.trim();
  const sprintDisplayLabel = activeSprintLabel
    ? activeSprintLabel.toLowerCase().startsWith("sprint")
      ? activeSprintLabel
      : `Sprint ${activeSprintLabel}`
    : "Sprint";
  const nextSprintDisplayLabel = useMemo(() => {
    if (!activeSprintLabel) return "";
    const numericMatch = activeSprintLabel.match(/\d+/);
    if (!numericMatch) return sprintDisplayLabel;
    const nextSprintNumber = Number(numericMatch[0]) + 1;
    return `Sprint ${nextSprintNumber}`;
  }, [activeSprintLabel, sprintDisplayLabel]);

  const currentStage = sessionState
    ? sessionState.navigation.activeSection === "discussion"
      ? "discussion"
      : sessionState.navigation.activeSection === "actions"
        ? "actionItems"
      : sessionState.navigation.activeSection === "happiness"
        ? happinessSubmitted
          ? "done"
          : "happinessCheck"
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
  const stageOrder = ["retro", "discussion", "actionItems", "happinessCheck", "done"] as const;
  const stageLabel: Record<(typeof stageOrder)[number], string> = {
    retro: "Retro",
    discussion: "Discussion",
    actionItems: "Action Items",
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
  const totalJoinees = sessionState?.participants.length ?? 0;
  const joineesDoneVoting = (sessionState?.participants ?? []).filter(
    (participant) => participant.votesRemaining === 0,
  ).length;
  const everyoneDoneVoting = totalJoinees > 0 && joineesDoneVoting >= totalJoinees;
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
  const entryBadge = (entryId: string, size: "sm" | "md" = "sm") => {
    const authorId = entryAuthorMap.get(entryId) ?? "";
    const authorName = participantMap.get(authorId)?.name ?? "";
    const tone = colorToneIndexFromSeed(authorId || entryId);
    const avatarSizeClass = size === "md" ? "size-8" : "size-6";
    const textSizeClass = size === "md" ? "text-[11px]" : "text-[10px]";
    return (
      <Avatar
        className={`identity-badge identity-tone-${tone} ${avatarSizeClass} shrink-0 border`}
        title={authorName || "Unknown"}
      >
        <AvatarFallback className={`bg-transparent ${textSizeClass} font-semibold text-inherit`}>
          {initialsFromName(authorName)}
        </AvatarFallback>
      </Avatar>
    );
  };

  const parsedVoteLimit = Number(voteLimitInput);
  const canEnterRetro =
    teamName.trim().length > 0 &&
    adminName.trim().length > 0 &&
    Number.isInteger(parsedVoteLimit) &&
    parsedVoteLimit >= 1 &&
    parsedVoteLimit <= 20;
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
  const totalParticipants = sessionState?.participants.length ?? 0;
  const submittedHappinessCount = sessionState?.happiness.count ?? 0;
  const overallHappinessAverage = sessionState?.happiness.average ?? null;
  const allHappinessSubmitted =
    totalParticipants > 0 && submittedHappinessCount >= totalParticipants;
  const actionItems = sessionState?.actionItems ?? [];
  const actionsMode = sessionState?.navigation.activeSection === "actions";
  const summaryMode = happinessMode && happinessSubmitted;

  // Normalizes server state into the local UI model.
  const applySessionState = useCallback((state: SessionStateResponse) => {
    setSessionState(state);
    setTeamName(state.session.title);
    setSprintLabel(state.session.sprintLabel ?? "");
    setVoteLimitInput(String(state.session.voteLimit));
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
        ? queue.findIndex((topic) => topicToEntryId(topic.id) === targetId)
        : 0;
      setDiscussionIndex(queueIndex >= 0 ? queueIndex : 0);
    } else {
      setDiscussionIndex(0);
    }

    setDiscussionMode(
      state.navigation.activeSection === "discussion" ||
        state.navigation.activeSection === "actions" ||
        state.navigation.activeSection === "happiness",
    );
    setHappinessMode(
      state.navigation.activeSection === "happiness" ||
        state.navigation.activeSection === "done",
    );
    setHappinessSubmitted(state.happiness.viewerSubmitted);
  }, []);

  // Single read path used for initial load and polling refreshes.
  const loadSessionState = useCallback(
    async (slug: string, token: string) => {
      const state = await getSessionState(slug, token);
      applySessionState(state);
    },
    [applySessionState],
  );

  const isRecoverableSessionError = useCallback((error: unknown) => {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes("session not found") ||
      message.includes("unauthorized") ||
      message.includes("token expired")
    );
  }, []);

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
    setSprintLabel("");
    setVoteLimitInput("5");
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
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!sessionSlug || !participantToken || !isSetupComplete) return;
    const timeout = window.setTimeout(() => {
      loadSessionState(sessionSlug, participantToken).catch((error: unknown) => {
        if (isRecoverableSessionError(error)) {
          clearStoredToken(sessionSlug);
          clearStoredActiveSlug();
          setSessionSlug("");
          setParticipantToken("");
          setSessionState(null);
          setWentRightItems([]);
          setWentWrongItems([]);
          setIsSetupComplete(false);
          setApiError("Saved session no longer exists. Please create or join a new session.");
          router.replace("/");
          return;
        }
        setApiError(
          error instanceof Error
            ? error.message
            : "Unable to restore previous session",
        );
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [
    isRecoverableSessionError,
    isSetupComplete,
    loadSessionState,
    participantToken,
    router,
    sessionSlug,
  ]);

  useEffect(() => {
    if (!isSetupComplete) return;
    if (sessionState?.navigation.activeSection !== "done") return;
    const timeout = window.setTimeout(() => {
      resetToCreateSession();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [
    isSetupComplete,
    resetToCreateSession,
    sessionState?.navigation.activeSection,
  ]);

  useEffect(() => {
    if (!sessionSlug || !participantToken || !isSetupComplete) return;
    const interval = setInterval(() => {
      loadSessionState(sessionSlug, participantToken).catch((error: unknown) => {
        // Keep polling resilient; recover only when session/token is no longer valid.
        if (!isRecoverableSessionError(error)) return;
        setApiError("This session is no longer available. Please create or join a new session.");
        resetToCreateSession();
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [
    isRecoverableSessionError,
    isSetupComplete,
    loadSessionState,
    participantToken,
    resetToCreateSession,
    sessionSlug,
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

  const launchSession = useCallback(async () => {
    if (!canEnterRetro) return;
    try {
      setApiError(null);
      const payload = await createSession({
        title: teamName.trim(),
        adminName: adminName.trim(),
        sprintLabel: sprintLabel.trim(),
        voteLimit: parsedVoteLimit,
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
        error instanceof Error ? error.message : "Unable to create session",
      );
    }
  }, [adminName, canEnterRetro, loadSessionState, parsedVoteLimit, sprintLabel, teamName]);

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

  const openEditEntry = (side: Side, id: string) => {
    const source = side === "right" ? wentRightItems : wentWrongItems;
    let existingText = "";
    for (const item of source) {
      if (item.kind === "item" && item.id === id) {
        existingText = item.text;
        break;
      }
      if (item.kind === "group") {
        const grouped = item.items.find((groupedItem) => groupedItem.id === id);
        if (grouped) {
          existingText = grouped.text;
          break;
        }
      }
    }
    if (!existingText) return;
    setPendingEdit({ entryId: id });
    setEditContentInput(existingText);
  };

  const saveEditedEntry = () => {
    if (!pendingEdit) return;
    const nextContent = editContentInput.trim();
    if (!nextContent) return;
    runMutation(() =>
      updateEntry(sessionSlug, participantToken, pendingEdit.entryId, nextContent),
    )
      .then(() => {
        setPendingEdit(null);
        setEditContentInput("");
      })
      .catch((error: unknown) => {
        setApiError(
          error instanceof Error ? error.message : "Unable to update entry",
        );
      });
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
        discussionEntryId: queue[0] ? topicToEntryId(queue[0].id) : null,
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
        discussionEntryId: nextTopic ? topicToEntryId(nextTopic.id) : null,
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
        discussionEntryId: previousTopic ? topicToEntryId(previousTopic.id) : null,
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
        activeSection: "actions",
        discussionEntryId: null,
      }),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error
          ? error.message
          : "Unable to move to action items",
      );
    });
  };

  const addActionItem = () => {
    if (!isAdmin) return;
    const next = actionItemInput.trim();
    if (!next) return;
    runMutation(() => createActionItem(sessionSlug, participantToken, next))
      .then(() => setActionItemInput(""))
      .catch((error: unknown) => {
        setApiError(
          error instanceof Error ? error.message : "Unable to create action item",
        );
      });
  };

  const removeActionItem = (actionItemId: string) => {
    if (!isAdmin) return;
    runMutation(() => deleteActionItem(sessionSlug, participantToken, actionItemId)).catch(
      (error: unknown) => {
        setApiError(
          error instanceof Error ? error.message : "Unable to delete action item",
        );
      },
    );
  };

  const proceedToHappiness = () => {
    if (!isAdmin) return;
    runMutation(() =>
      setNavigation(sessionSlug, participantToken, {
        activeSection: "happiness",
        discussionEntryId: null,
      }),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to move to happiness check",
      );
    });
  };

  const returnToBoard = () => {
    if (!isAdmin) return;
    runMutation(() =>
      setNavigation(sessionSlug, participantToken, {
        activeSection: "retro",
      }),
    ).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to return to board",
      );
    });
  };

  const submitHappinessCheck = () => {
    runMutation(() => upsertHappiness(sessionSlug, participantToken, happinessScore))
      .then(() => setHappinessSubmitted(true))
      .catch((error: unknown) => {
        setApiError(
          error instanceof Error ? error.message : "Unable to submit happiness",
        );
      });
  };

  return (
    <main className="mx-auto my-12 max-w-[1180px] px-7 max-[840px]:my-7">
      <GroupNameDialog
        open={Boolean(pendingGroup)}
        value={groupNameInput}
        onValueChange={setGroupNameInput}
        onClose={() => {
          setPendingGroup(null);
          setGroupNameInput("");
        }}
        onCreate={createPendingGroup}
      />
      <EditCommentDialog
        open={Boolean(pendingEdit)}
        value={editContentInput}
        onValueChange={setEditContentInput}
        onClose={() => {
          setPendingEdit(null);
          setEditContentInput("");
        }}
        onSave={saveEditedEntry}
      />

      <AppShellHeader
        isSetupComplete={isSetupComplete}
        stageOrder={stageOrder}
        stageLabel={stageLabel}
        currentStageIndex={currentStageIndex}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        currentUserTone={currentUserTone}
        currentUserInitials={currentUserInitials}
      />

      {!isSetupComplete ? (
        <SetupScreen
          inviteSlugFromUrl={inviteSlugFromUrl}
          teamName={teamName}
          adminName={adminName}
          sprintLabel={sprintLabel}
          voteLimit={voteLimitInput}
          joinSessionCode={joinSessionCode}
          joinParticipantName={joinParticipantName}
          canEnterRetro={canEnterRetro}
          canJoinSession={canJoinSession}
          apiError={apiError}
          joinError={joinError}
          onTeamNameChange={setTeamName}
          onAdminNameChange={setAdminName}
          onSprintLabelChange={setSprintLabel}
          onVoteLimitChange={setVoteLimitInput}
          onJoinSessionCodeChange={setJoinSessionCode}
          onJoinParticipantNameChange={setJoinParticipantName}
          onCreateSession={launchSession}
          onJoinSession={joinExistingSession}
          onClearJoinError={() => setJoinError(null)}
        />
      ) : (
        <SessionScreen
          teamName={teamName}
          sessionId={sessionId}
          sprintDisplayLabel={sprintDisplayLabel}
          nextSprintDisplayLabel={nextSprintDisplayLabel}
          showSprintLabel={Boolean(activeSprintLabel)}
          inviteCopied={inviteCopied}
          apiError={apiError}
          discussionMode={discussionMode}
          summaryMode={summaryMode}
          actionsMode={actionsMode}
          happinessMode={happinessMode}
          isAdmin={isAdmin}
          hasDiscussionItems={hasDiscussionItems}
          everyoneDoneVoting={everyoneDoneVoting}
          actionItems={actionItems}
          actionItemInput={actionItemInput}
          totalParticipants={totalParticipants}
          submittedHappinessCount={submittedHappinessCount}
          overallHappinessAverage={overallHappinessAverage}
          happinessSubmitted={happinessSubmitted}
          happinessScore={happinessScore}
          happinessMood={happinessMood}
          allHappinessSubmitted={allHappinessSubmitted}
          currentDiscussion={currentDiscussion}
          currentDiscussionEntryId={currentDiscussionEntryId}
          currentDiscussionEntry={currentDiscussionEntry}
          discussionIndex={discussionIndex}
          discussionQueueLength={discussionQueue.length}
          sortedRight={sortedRight}
          sortedWrong={sortedWrong}
          participants={sessionState?.participants ?? []}
          joineesDoneVoting={joineesDoneVoting}
          entryBadge={entryBadge}
          onCopyInviteLink={copyInviteLink}
          onStartDiscussion={startDiscussion}
          onBackToBoard={returnToBoard}
          onEndSession={endSession}
          onActionItemInputChange={setActionItemInput}
          onAddActionItem={addActionItem}
          onRemoveActionItem={removeActionItem}
          onProceedToHappiness={proceedToHappiness}
          onHappinessScoreChange={setHappinessScore}
          onSubmitHappiness={submitHappinessCheck}
          onPreviousDiscussion={previousDiscussion}
          onNextDiscussion={nextDiscussion}
          onFinishDiscussion={finishDiscussion}
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
          onRemoveItem={removeItem}
          onEditItem={openEditEntry}
          canRemove={(id) => isAdmin || entryAuthorMap.get(id) === viewerId}
          canEdit={(id) => isAdmin || entryAuthorMap.get(id) === viewerId}
          onUndoGroupedItem={undoGroupedItem}
          wentRightInput={wentRightInput}
          wentWrongInput={wentWrongInput}
          onWentRightInputChange={setWentRightInput}
          onWentWrongInputChange={setWentWrongInput}
          onAddWentRight={addWentRight}
          onAddWentWrong={addWentWrong}
        />
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
