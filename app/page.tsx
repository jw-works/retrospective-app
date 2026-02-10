"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { colorFromSeed, initialsFromName, parseSessionCode, toRetroItems } from "@/lib/retro/utils";

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

type ApiError = { error?: string };

const ACTIVE_SLUG_KEY = "retro.activeSlug";
const tokenKey = (slug: string) => `retro.token.${slug}`;

export default function Home() {
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
      new Map(
        (sessionState?.entries ?? []).map((entry) => [
          entry.id,
          entry
        ]),
      ),
    [sessionState],
  );
  const viewerName = sessionState?.viewer?.name ?? "";
  const currentUserInitials = useMemo(
    () => initialsFromName(isSetupComplete ? viewerName || adminName : adminName),
    [adminName, isSetupComplete, viewerName]
  );
  const currentUserColor = useMemo(
    () => colorFromSeed((sessionState?.viewer?.id ?? "") || viewerName || adminName || "user"),
    [adminName, sessionState?.viewer?.id, viewerName]
  );
  const entryBadge = (entryId: string) => {
    const authorId = entryAuthorMap.get(entryId) ?? "";
    const authorName = participantMap.get(authorId)?.name ?? "";
    const color = colorFromSeed(authorId || entryId);
    return (
      <span
        className="grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold"
        style={{
          background: color.background,
          borderColor: color.border,
          color: color.text
        }}
        title={authorName || "Unknown"}
      >
        {initialsFromName(authorName)}
      </span>
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
      const queueIndex = targetId ? queue.findIndex((topic) => topic.id === targetId) : 0;
      setDiscussionIndex(queueIndex >= 0 ? queueIndex : 0);
    } else {
      setDiscussionIndex(0);
    }

    setDiscussionMode(state.navigation.activeSection === "discussion" || state.navigation.activeSection === "happiness");
    setHappinessMode(state.navigation.activeSection === "happiness" || state.navigation.activeSection === "done");
  }, []);

  const loadSessionState = useCallback(
    async (slug: string, token: string) => {
      const response = await fetch(`/api/sessions/${slug}/state`, {
        cache: "no-store",
        headers: token ? { "x-participant-token": token } : {},
      });
      const payload = (await response.json()) as
        | SessionStateResponse
        | ApiError;
      if (!response.ok || !("session" in payload)) {
        throw new Error(
          "error" in payload
            ? (payload.error ?? "Unable to load session")
            : "Unable to load session",
        );
      }
      applySessionState(payload);
    },
    [applySessionState],
  );

  const apiRequest = useCallback(
    async (path: string, options: RequestInit) => {
      if (!sessionSlug || !participantToken)
        throw new Error("Missing session credentials");
      const response = await fetch(path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-participant-token": participantToken,
          ...(options.headers ?? {}),
        },
      });
      const payload = (await response.json()) as ApiError;
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }
      await loadSessionState(sessionSlug, participantToken);
    },
    [loadSessionState, participantToken, sessionSlug],
  );

  const resetToCreateSession = useCallback(() => {
    if (sessionSlug) {
      localStorage.removeItem(tokenKey(sessionSlug));
    }
    localStorage.removeItem(ACTIVE_SLUG_KEY);
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
      const response = await fetch(`/api/sessions/${sessionSlug}/navigation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-participant-token": participantToken,
        },
        body: JSON.stringify({ activeSection: "done" }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error ?? "Unable to end session");
      }
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
    const slug = localStorage.getItem(ACTIVE_SLUG_KEY);
    const targetSlug = inviteSlugFromUrl || slug;
    if (!targetSlug) return;
    const token = localStorage.getItem(tokenKey(targetSlug)) ?? "";
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
  }, [isSetupComplete, resetToCreateSession, sessionState?.navigation.activeSection]);

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
      setApiError(null);
      const slug = parseSessionCode(joinSessionCode);
      const response = await fetch(`/api/sessions/${slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: joinParticipantName.trim(),
        }),
      });
      const payload = (await response.json()) as
        | {
            token: string;
            sessionSlug: string;
          }
        | ApiError;

      if (!response.ok || !("token" in payload)) {
        throw new Error(
          "error" in payload
            ? payload.error ?? "Unable to join session"
            : "Unable to join session",
        );
      }

      localStorage.setItem(ACTIVE_SLUG_KEY, payload.sessionSlug);
      localStorage.setItem(tokenKey(payload.sessionSlug), payload.token);
      setSessionSlug(payload.sessionSlug);
      setParticipantToken(payload.token);
      setIsSetupComplete(true);
      await loadSessionState(payload.sessionSlug, payload.token);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to join session");
    }
  }, [canJoinSession, joinParticipantName, joinSessionCode, loadSessionState]);

  const addStandaloneItem = (side: Side, text: string) => {
    const type = side === "right" ? "went_right" : "went_wrong";
    apiRequest(`/api/sessions/${sessionSlug}/entries`, {
      method: "POST",
      body: JSON.stringify({ type, content: text }),
    }).catch((error: unknown) => {
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
      const votedEntryId = groupedIds.find((entryId) => sessionEntryMap.get(entryId)?.votedByViewer);
      const voteTargetId = votedEntryId ?? groupedIds[0];
      if (!voteTargetId) return;

      const method = votedEntryId ? "DELETE" : "POST";
      const path = votedEntryId
        ? `/api/sessions/${sessionSlug}/votes/${voteTargetId}`
        : `/api/sessions/${sessionSlug}/votes`;
      const body = votedEntryId ? undefined : JSON.stringify({ entryId: voteTargetId });

      apiRequest(path, { method, body }).catch((error: unknown) => {
        setApiError(
          error instanceof Error ? error.message : "Unable to update vote",
        );
      });
      return;
    }

    const method = target.voted ? "DELETE" : "POST";
    const path = target.voted
      ? `/api/sessions/${sessionSlug}/votes/${id}`
      : `/api/sessions/${sessionSlug}/votes`;
    const body = target.voted ? undefined : JSON.stringify({ entryId: id });

    apiRequest(path, { method, body }).catch((error: unknown) => {
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
      const ungroupRequests = target.items.map((item) =>
        fetch(`/api/sessions/${sessionSlug}/groups/${target.id}/entries/${item.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-participant-token": participantToken
          }
        }).then(async (response) => {
          if (!response.ok) {
            const payload = (await response.json()) as ApiError;
            throw new Error(payload.error ?? "Unable to ungroup");
          }
        })
      );

      Promise.all(ungroupRequests)
        .then(() => loadSessionState(sessionSlug, participantToken))
        .catch((error: unknown) => {
          setApiError(error instanceof Error ? error.message : "Unable to ungroup items");
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

    apiRequest(`/api/sessions/${sessionSlug}/entries/${id}`, {
      method: "DELETE",
    }).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to remove entry",
      );
    });
  };

  const groupItemsInSide = (
    _side: Side,
    sourceId: string,
    targetId: string,
    groupName: string,
  ) => {
    apiRequest(`/api/sessions/${sessionSlug}/groups`, {
      method: "POST",
      body: JSON.stringify({
        sourceEntryId: sourceId,
        targetEntryId: targetId,
        name: groupName
      })
    }).catch((error: unknown) => {
      setApiError(error instanceof Error ? error.message : "Unable to create group");
    });
  };

  const addItemToExistingGroup = (
    _side: Side,
    sourceId: string,
    targetGroupId: string,
  ) => {
    apiRequest(`/api/sessions/${sessionSlug}/groups/${targetGroupId}/entries`, {
      method: "POST",
      body: JSON.stringify({ entryId: sourceId })
    }).catch((error: unknown) => {
      setApiError(error instanceof Error ? error.message : "Unable to add to group");
    });
  };

  const moveItemAcrossSides = (
    sourceSide: Side,
    targetSide: Side,
    sourceId: string,
  ) => {
    if (sourceSide === targetSide) return;
    const nextType = targetSide === "right" ? "went_right" : "went_wrong";
    apiRequest(`/api/sessions/${sessionSlug}/entries/${sourceId}/move`, {
      method: "POST",
      body: JSON.stringify({ type: nextType })
    }).catch((error: unknown) => {
      setApiError(error instanceof Error ? error.message : "Unable to move entry");
    });
  };

  const extractGroupedItem = async (
    sourceSide: Side,
    groupId: string,
    itemId: string,
  ): Promise<string | null> => {
    const sourceItems = sourceSide === "right" ? wentRightItems : wentWrongItems;
    const targetGroup = sourceItems.find((entry) => entry.id === groupId);
    if (!targetGroup || targetGroup.kind !== "group") return null;
    const extracted = targetGroup.items.find((entry) => entry.id === itemId);
    if (!extracted) return null;

    await apiRequest(`/api/sessions/${sessionSlug}/groups/${groupId}/entries/${itemId}`, {
      method: "DELETE"
    });
    return extracted.text;
  };

  const undoGroupedItem = (side: Side, groupId: string, itemId: string) => {
    void side;
    extractGroupedItem(side, groupId, itemId).catch((error: unknown) => {
      setApiError(error instanceof Error ? error.message : "Unable to ungroup item");
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
          setApiError(error instanceof Error ? error.message : "Unable to move grouped item");
        });
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
      extractGroupedItem(dragging.sourceSide, dragging.groupId, dragging.itemId)
        .then((text) => {
          if (!text) return;
          addStandaloneItem(targetSide, text);
        })
        .catch((error: unknown) => {
          setApiError(error instanceof Error ? error.message : "Unable to move grouped item");
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
    apiRequest(`/api/sessions/${sessionSlug}/navigation`, {
      method: "POST",
      body: JSON.stringify({ activeSection: "discussion", discussionEntryId: queue[0]?.id ?? null }),
    }).catch((error: unknown) => {
      setApiError(
        error instanceof Error ? error.message : "Unable to start discussion",
      );
    });
  };

  const nextDiscussion = () => {
    if (!isAdmin) return;
    if (discussionIndex >= discussionQueue.length - 1) return;
    const nextTopic = discussionQueue[discussionIndex + 1];
    apiRequest(`/api/sessions/${sessionSlug}/navigation`, {
      method: "POST",
      body: JSON.stringify({ activeSection: "discussion", discussionEntryId: nextTopic?.id ?? null }),
    }).catch((error: unknown) => {
      setApiError(error instanceof Error ? error.message : "Unable to move to next topic");
    });
  };

  const previousDiscussion = () => {
    if (!isAdmin) return;
    if (discussionIndex === 0) return;
    const previousTopic = discussionQueue[discussionIndex - 1];
    apiRequest(`/api/sessions/${sessionSlug}/navigation`, {
      method: "POST",
      body: JSON.stringify({ activeSection: "discussion", discussionEntryId: previousTopic?.id ?? null }),
    }).catch((error: unknown) => {
      setApiError(error instanceof Error ? error.message : "Unable to move to previous topic");
    });
  };

  const finishDiscussion = () => {
    if (!isAdmin) return;
    apiRequest(`/api/sessions/${sessionSlug}/navigation`, {
      method: "POST",
      body: JSON.stringify({ activeSection: "happiness", discussionEntryId: null }),
    }).catch((error: unknown) => {
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
        {isSetupComplete ? (
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
                  {index < stageOrder.length - 1 ? (
                    <span className="text-[#9aa0a6]">›</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/35 px-3 py-2 text-xs text-[#5f656d] before:size-1.5 before:rounded-full before:bg-[#c9ccd1] before:content-['']">
              Session Launchpad
            </span>
            <span className="text-xs text-[#8b9096]">
              Create your retrospective room
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span
            className="grid size-[34px] place-items-center rounded-full border text-[11px] font-medium shadow-[0_10px_22px_rgba(0,0,0,0.07)]"
            style={{
              background: currentUserColor.background,
              borderColor: currentUserColor.border,
              color: currentUserColor.text
            }}
          >
            {currentUserInitials}
          </span>
        </div>
      </header>

      {!isSetupComplete ? (
        inviteSlugFromUrl ? (
          <section className="my-[14px] mb-[26px]">
            <div className="mx-auto max-w-[540px] overflow-hidden rounded-[20px] border border-black/6 bg-[#eeeeef] p-7 shadow-[0_24px_46px_rgba(0,0,0,0.06)]">
              <p className="text-xs tracking-[0.2em] text-[#7a8088] uppercase">
                Join Session
              </p>
              <h1 className="mt-2 text-[34px] leading-[1.1] font-medium text-[#3a3d41]">
                Enter Your Name
              </h1>
              <p className="mt-2 text-sm text-[#6f757d]">
                You are joining session{" "}
                <span className="font-medium text-[#565b62]">
                  {inviteSlugFromUrl}
                </span>
                .
              </p>
              <div className="mt-6">
                <input
                  className="block h-[44px] w-full rounded-[12px] border border-black/6 bg-white/50 px-3 text-[#565b62] placeholder:text-[#9aa0a6]"
                  type="text"
                  placeholder="Your name"
                  value={joinParticipantName}
                  onChange={(event) => setJoinParticipantName(event.target.value)}
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
              {apiError ? (
                <p className="mt-3 text-sm text-[#a64141]">{apiError}</p>
              ) : null}
            </div>
          </section>
        ) : (
        <section className="my-[14px] mb-[26px]">
          <div className="relative overflow-hidden rounded-[20px] border border-black/6 bg-[#eeeeef] p-7 shadow-[0_24px_46px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_10%_15%,rgba(255,255,255,0.7),rgba(255,255,255,0)_46%),radial-gradient(circle_at_90%_90%,rgba(255,255,255,0.5),rgba(255,255,255,0)_45%)] before:content-['']">
            <div className="relative z-10 grid grid-cols-[1.45fr_1fr] gap-6 max-[840px]:grid-cols-1">
              <section>
                <p className="text-xs tracking-[0.2em] text-[#7a8088] uppercase">
                  Welcome
                </p>
                <h1 className="mt-2 text-[38px] leading-[1.05] font-medium text-[#3a3d41]">
                  Open a New Retro Room
                </h1>
                <p className="mt-3 max-w-[45ch] text-sm text-[#6f757d]">
                  Give your session a team identity and assign the facilitator
                  before the board unlocks.
                </p>

                <div className="mt-6 grid gap-3">
                  <div>
                    <label
                      htmlFor="team-name"
                      className="mb-1 block text-sm text-[#565b62]"
                    >
                      Team Name
                    </label>
                    <input
                      id="team-name"
                      className="block h-[44px] w-full rounded-[12px] border border-black/6 bg-white/50 px-3 text-[#565b62] placeholder:text-[#9aa0a6]"
                      type="text"
                      placeholder="e.g. Product Engineering"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="admin-name"
                      className="mb-1 block text-sm text-[#565b62]"
                    >
                      Facilitator Name
                    </label>
                    <input
                      id="admin-name"
                      className="block h-[44px] w-full rounded-[12px] border border-black/6 bg-white/50 px-3 text-[#565b62] placeholder:text-[#9aa0a6]"
                      type="text"
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
                        const response = await fetch("/api/sessions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: teamName.trim(),
                            adminName: adminName.trim(),
                          }),
                        });
                        const payload = (await response.json()) as
                          | {
                              session: { slug: string };
                              token: string;
                            }
                          | ApiError;

                        if (!response.ok || !("session" in payload)) {
                          throw new Error(
                            "error" in payload
                              ? (payload.error ?? "Unable to create session")
                              : "Unable to create session",
                          );
                        }

                        const slug = payload.session.slug;
                        localStorage.setItem(ACTIVE_SLUG_KEY, slug);
                        localStorage.setItem(tokenKey(slug), payload.token);
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
                  <p className="mt-3 text-sm text-[#a64141]">{apiError}</p>
                ) : null}
              </section>

              <section className="rounded-[16px] border border-black/6 bg-white/35 p-5">
                <h3 className="m-0 text-base font-medium text-[#565b62]">
                  Join Instead
                </h3>
                <p className="mt-2 text-xs text-[#7a8088]">
                  Got a shared session code? Join an existing retrospective
                  room.
                </p>
                <div className="mt-4 grid gap-2.5 rounded-[14px] border border-black/6 bg-white/45 p-4">
                  <input
                    className="block h-[40px] w-full rounded-[10px] border border-black/6 bg-white/65 px-3 text-sm text-[#565b62] placeholder:text-[#9aa0a6]"
                    type="text"
                    placeholder="Session code or invite URL"
                    value={joinSessionCode}
                    onChange={(event) => setJoinSessionCode(event.target.value)}
                  />
                  <input
                    className="block h-[40px] w-full rounded-[10px] border border-black/6 bg-white/65 px-3 text-sm text-[#565b62] placeholder:text-[#9aa0a6]"
                    type="text"
                    placeholder="Your name"
                    value={joinParticipantName}
                    onChange={(event) =>
                      setJoinParticipantName(event.target.value)
                    }
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
                <div className="mt-4 rounded-[12px] border border-black/6 bg-white/35 px-3 py-2 text-xs text-[#7a8088]">
                  Ask the admin to share the invite code from their session.
                </div>
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
                <h1 className="m-0 text-[34px] leading-[1.15] font-medium text-[#3a3d41]">
                  {teamName.trim()} Retrospective
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7a8088]">
                  <span className="rounded-[10px] border border-black/8 bg-white/40 px-2.5 py-1">
                    {sessionId}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-[10px] border border-black/8 bg-white/40 px-2.5 py-1 text-[#6a7078]"
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
                      apiRequest(`/api/sessions/${sessionSlug}/navigation`, {
                        method: "POST",
                        body: JSON.stringify({ activeSection: "retro" }),
                      }).catch((error: unknown) => {
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
              <p className="mt-2 text-sm text-[#a64141]">{apiError}</p>
            ) : null}
          </section>

          <section className="grid grid-cols-[1.2fr_1.2fr_0.9fr] items-stretch gap-[22px] max-[840px]:grid-cols-1">
            {discussionMode ? (
              <section className="relative col-span-2 min-h-[220px] overflow-hidden rounded-[18px] border border-black/6 bg-[#eeeeef] p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-[''] max-[840px]:col-span-1 max-[840px]:min-h-[200px]">
                <div className="relative z-10 min-h-[320px]">
                  {happinessMode ? (
                    <div className="max-w-xl">
                      <p className="text-sm text-[#7a8088]">Session complete</p>
                      <h2 className="mt-2 text-[26px] leading-[1.2] font-medium text-[#3a3d41]">
                        Happiness Check
                      </h2>
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
                          onChange={(event) =>
                            setHappinessScore(Number(event.target.value))
                          }
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
                        <p className="mt-5 text-sm text-[#565b62]">
                          Thanks. Happiness score recorded.
                        </p>
                      ) : null}
                    </div>
                  ) : currentDiscussion ? (
                    <>
                      <p className="text-sm text-[#7a8088]">
                        {currentDiscussion.side === "right"
                          ? "What went right"
                          : "What went wrong"}{" "}
                        · {currentDiscussion.votes} votes
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
                    <p className="text-sm text-[#7a8088]">
                      No topics available yet.
                    </p>
                  )}

                  {happinessMode && !happinessSubmitted ? (
                    <div className="absolute right-0 bottom-0">
                      <Button
                        type="button"
                        onClick={() => {
                          apiRequest(`/api/sessions/${sessionSlug}/happiness`, {
                            method: "POST",
                            body: JSON.stringify({ score: happinessScore }),
                          })
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
                      <span className="absolute bottom-1 left-0 text-sm text-[#7a8088]">
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
                    setDragging({ sourceSide: side, kind: "grouped-item", groupId, itemId });
                  }}
                  onDragEnd={() => setDragging(null)}
                  onToggleVote={toggleVote}
                  onRemove={removeItem}
                  canRemove={(id) => isAdmin || entryAuthorMap.get(id) === viewerId}
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
                    setDragging({ sourceSide: side, kind: "grouped-item", groupId, itemId });
                  }}
                  onDragEnd={() => setDragging(null)}
                  onToggleVote={toggleVote}
                  onRemove={removeItem}
                  canRemove={(id) => isAdmin || entryAuthorMap.get(id) === viewerId}
                  onUndoGroupedItem={undoGroupedItem}
                  renderEntryBadge={entryBadge}
                />
              </>
            )}

            <aside className="flex flex-col gap-4">
              <section className="relative overflow-hidden rounded-2xl border border-black/6 bg-[#eeeeef] p-[18px] shadow-[0_18px_38px_rgba(0,0,0,0.05)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-['']">
                <div className="relative z-10">
                  <h3 className="m-0 text-base font-medium text-[#565b62]">
                    Joinees List
                  </h3>
                  <ul
                    aria-label="Joinees list"
                    className="mt-3 flex list-none flex-col gap-2.5 p-0"
                  >
                    {(sessionState?.participants ?? []).map((person) => (
                      <li
                        key={person.id}
                        className="flex items-center justify-between gap-3 rounded-[14px] border border-black/6 bg-white/28 px-3 py-3"
                      >
                        <span className="inline-flex items-center gap-2.5 text-sm text-[#4f545a]">
                          <span
                            aria-hidden
                            className="grid size-[24px] place-items-center rounded-full border text-[10px] font-semibold"
                            style={{
                              background: colorFromSeed(person.id).background,
                              borderColor: colorFromSeed(person.id).border,
                              color: colorFromSeed(person.id).text
                            }}
                          >
                            {initialsFromName(person.name)}
                          </span>
                          {person.name}
                        </span>
                        {person.isAdmin ? (
                          <span className="text-xs text-[#7a8088]">admin</span>
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
