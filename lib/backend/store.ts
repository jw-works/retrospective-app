import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { issueParticipantToken, verifyParticipantToken } from "@/lib/backend/auth";
import { logInfo } from "@/lib/backend/observability";
import type {
  Entry,
  EntryGroup,
  EntryType,
  ActionItem,
  HappinessCheck,
  NavigationState,
  Participant,
  Section,
  Session,
  SessionStateResponse,
  StoreData,
  Vote
} from "@/lib/backend/types";

// File-backed store implementing business rules for sessions, entries, voting,
// grouping, navigation, and happiness checks.
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "retro-store.json");
const VOTE_LIMIT_PER_PARTICIPANT = 5;

let writeQueue: Promise<unknown> = Promise.resolve();

const createInitialData = (): StoreData => ({
  sessions: [],
  participants: [],
  entries: [],
  groups: [],
  actionItems: [],
  votes: [],
  happinessChecks: [],
  navigation: [],
  authTokens: []
});

const nowIso = () => new Date().toISOString();

const normalizeSlug = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);

const randomSegment = () => Math.random().toString(36).slice(2, 8);

const buildSlug = (title: string) => {
  const base = normalizeSlug(title) || "retro-session";
  return `${base}-${randomSegment()}`;
};

async function readStore(): Promise<StoreData> {
  await mkdir(DATA_DIR, { recursive: true });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const raw = await readFile(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      return {
        sessions: parsed.sessions ?? [],
        participants: parsed.participants ?? [],
        entries: (parsed.entries ?? []).map((entry) => ({
          ...entry,
          groupId: entry.groupId ?? null
        })),
        groups: parsed.groups ?? [],
        actionItems: parsed.actionItems ?? [],
        votes: parsed.votes ?? [],
        happinessChecks: parsed.happinessChecks ?? [],
        navigation: parsed.navigation ?? [],
        authTokens: parsed.authTokens ?? []
      };
    } catch (error: unknown) {
      const fsCode = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
      if (fsCode === "ENOENT") {
        const initial = createInitialData();
        await writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
        return initial;
      }

      // A read can race a write and observe partial JSON; retry briefly.
      if (error instanceof SyntaxError && attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 15));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to read store");
}

async function writeStore(next: StoreData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
}

async function withStoreLock<T>(fn: (store: StoreData) => Promise<T> | T): Promise<T> {
  const run = async () => {
    const store = await readStore();
    const result = await fn(store);
    await writeStore(store);
    return result;
  };

  const operation = writeQueue.then(run, run);
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

function getSessionBySlug(store: StoreData, slug: string) {
  return store.sessions.find((item) => item.slug === slug);
}

function getParticipantByToken(store: StoreData, token: string, sessionId: string): Participant {
  const decoded = verifyParticipantToken(token);
  if (decoded.sessionId !== sessionId) throw new Error("Unauthorized");

  const participant = store.participants.find(
    (item) => item.id === decoded.participantId && item.sessionId === sessionId
  );
  if (!participant) throw new Error("Unauthorized");

  return participant;
}

function assertAdmin(participant: Participant): void {
  if (!participant.isAdmin) throw new Error("Forbidden");
}

function getNavigation(store: StoreData, sessionId: string): NavigationState {
  let nav = store.navigation.find((item) => item.sessionId === sessionId);
  if (nav) return nav;

  nav = {
    sessionId,
    activeSection: "retro",
    discussionEntryId: null,
    updatedAt: nowIso()
  };
  store.navigation.push(nav);
  return nav;
}

function getGroupEntries(store: StoreData, groupId: string) {
  return store.entries.filter((entry) => entry.groupId === groupId);
}

function cleanupGroupIfSmall(store: StoreData, groupId: string) {
  const groupedEntries = getGroupEntries(store, groupId);
  if (groupedEntries.length >= 2) return;

  for (const entry of groupedEntries) {
    entry.groupId = null;
  }
  store.groups = store.groups.filter((group) => group.id !== groupId);
}

function sessionStateFromStore(store: StoreData, session: Session, viewer: Participant | null): SessionStateResponse {
  const viewerVotes = viewer
    ? store.votes.filter((vote) => vote.sessionId === session.id && vote.participantId === viewer.id)
    : [];
  const viewerVoteEntryIds = new Set(viewerVotes.map((vote) => vote.entryId));

  const participants = store.participants
    .filter((item) => item.sessionId === session.id)
    .map((item) => ({
      votesUsed: store.votes.filter(
        (vote) => vote.sessionId === session.id && vote.participantId === item.id
      ).length,
      votesRemaining: Math.max(
        0,
        VOTE_LIMIT_PER_PARTICIPANT -
          store.votes.filter(
            (vote) => vote.sessionId === session.id && vote.participantId === item.id
          ).length
      ),
      id: item.id,
      name: item.name,
      isAdmin: item.isAdmin,
      createdAt: item.createdAt
    }));

  const entries = store.entries
    .filter((item) => item.sessionId === session.id)
    .map((entry) => ({
      ...entry,
      votes: store.votes.filter((vote) => vote.entryId === entry.id).length,
      votedByViewer: viewer ? viewerVoteEntryIds.has(entry.id) : false
    }));

  const groups = store.groups.filter((group) => group.sessionId === session.id);
  const actionItems = store.actionItems.filter((item) => item.sessionId === session.id);

  const sessionHappiness = store.happinessChecks.filter((item) => item.sessionId === session.id);
  const happinessTotal = sessionHappiness.reduce((sum, item) => sum + item.score, 0);
  const happinessAverage = sessionHappiness.length > 0 ? Number((happinessTotal / sessionHappiness.length).toFixed(2)) : null;
  const viewerSubmitted = viewer
    ? sessionHappiness.some((item) => item.participantId === viewer.id)
    : false;

  return {
    session: {
      id: session.id,
      slug: session.slug,
      title: session.title,
      sprintLabel: session.sprintLabel ?? null,
      phase: session.phase,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    },
    participants,
    entries,
    groups,
    actionItems,
    navigation: getNavigation(store, session.id),
    viewer: viewer
      ? {
          id: viewer.id,
          name: viewer.name,
          isAdmin: viewer.isAdmin,
          votesUsed: viewerVotes.length,
          votesRemaining: Math.max(0, VOTE_LIMIT_PER_PARTICIPANT - viewerVotes.length)
        }
      : null,
    happiness: {
      average: happinessAverage,
      count: sessionHappiness.length,
      viewerSubmitted
    }
  };
}

export const backendStore = {
  // Creates a session, admin participant, initial navigation state, and token.
  async createSession(input: { title: string; adminName: string; sprintLabel?: string }) {
    return withStoreLock((store) => {
      const now = nowIso();
      const sessionId = randomUUID();
      const participantId = randomUUID();
      const session: Session = {
        id: sessionId,
        slug: buildSlug(input.title),
        title: input.title.trim(),
        sprintLabel: input.sprintLabel?.trim() || null,
        createdByParticipantId: participantId,
        phase: "collecting",
        createdAt: now,
        updatedAt: now
      };

      const participant: Participant = {
        id: participantId,
        sessionId,
        name: input.adminName.trim(),
        isAdmin: true,
        createdAt: now
      };
      const token = issueParticipantToken({ participantId, sessionId });

      store.sessions.push(session);
      store.participants.push(participant);
      store.navigation.push({
        sessionId,
        activeSection: "retro",
        discussionEntryId: null,
        updatedAt: now
      });
      logInfo("session.created", {
        sessionId,
        sessionSlug: session.slug,
        adminParticipantId: participantId
      });

      return {
        session,
        participant,
        token,
        joinUrl: `/session/${session.slug}/join`
      };
    });
  },

  // Adds a non-admin participant and returns their auth token.
  async joinSession(input: { slug: string; name: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const now = nowIso();
      const participant: Participant = {
        id: randomUUID(),
        sessionId: session.id,
        name: input.name.trim(),
        isAdmin: false,
        createdAt: now
      };
      const token = issueParticipantToken({ participantId: participant.id, sessionId: session.id });

      store.participants.push(participant);
      logInfo("session.joined", {
        sessionId: session.id,
        sessionSlug: session.slug,
        participantId: participant.id
      });

      return { participant, token, sessionSlug: session.slug };
    });
  },

  // Returns the read model consumed by the frontend.
  async getSessionState(input: { slug: string; token?: string | null }) {
    const store = await readStore();
    const session = getSessionBySlug(store, input.slug);
    if (!session) throw new Error("Session not found");

    let viewer: Participant | null = null;
    if (input.token) {
      viewer = getParticipantByToken(store, input.token, session.id);
    }

    return sessionStateFromStore(store, session, viewer);
  },

  // Creates a single entry on either side of the board.
  async createEntry(input: { slug: string; token: string; type: EntryType; content: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const participant = getParticipantByToken(store, input.token, session.id);

      const entry: Entry = {
        id: randomUUID(),
        sessionId: session.id,
        authorParticipantId: participant.id,
        type: input.type,
        content: input.content.trim(),
        groupId: null,
        createdAt: nowIso()
      };

      store.entries.push(entry);
      session.updatedAt = nowIso();
      logInfo("entry.created", { sessionId: session.id, entryId: entry.id, authorParticipantId: participant.id });

      return entry;
    });
  },

  // Deletes one entry with permission checks (admin or author).
  async deleteEntry(input: { slug: string; token: string; entryId: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const participant = getParticipantByToken(store, input.token, session.id);
      const entry = store.entries.find((item) => item.id === input.entryId && item.sessionId === session.id);
      if (!entry) throw new Error("Entry not found");

      if (!participant.isAdmin && entry.authorParticipantId !== participant.id) {
        throw new Error("Forbidden");
      }

      store.entries = store.entries.filter((item) => item.id !== entry.id);
      store.votes = store.votes.filter((item) => item.entryId !== entry.id);
      if (entry.groupId) cleanupGroupIfSmall(store, entry.groupId);
      session.updatedAt = nowIso();
      logInfo("entry.deleted", { sessionId: session.id, entryId: entry.id, actorParticipantId: participant.id });

      return { success: true };
    });
  },

  // Updates one entry content with permission checks (admin or author).
  async updateEntry(input: { slug: string; token: string; entryId: string; content: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const participant = getParticipantByToken(store, input.token, session.id);
      const entry = store.entries.find((item) => item.id === input.entryId && item.sessionId === session.id);
      if (!entry) throw new Error("Entry not found");

      if (!participant.isAdmin && entry.authorParticipantId !== participant.id) {
        throw new Error("Forbidden");
      }

      const nextContent = input.content.trim();
      if (!nextContent) throw new Error("Entry content is required");

      entry.content = nextContent;
      session.updatedAt = nowIso();
      logInfo("entry.updated", { sessionId: session.id, entryId: entry.id, actorParticipantId: participant.id });

      return entry;
    });
  },

  // Admin-only bulk clear for session entries/groups/votes.
  async clearEntries(input: { slug: string; token: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const participant = getParticipantByToken(store, input.token, session.id);
      assertAdmin(participant);

      const sessionEntryIds = new Set(store.entries.filter((item) => item.sessionId === session.id).map((item) => item.id));
      store.entries = store.entries.filter((item) => item.sessionId !== session.id);
      store.groups = store.groups.filter((group) => group.sessionId !== session.id);
      store.votes = store.votes.filter((item) => !sessionEntryIds.has(item.entryId));
      session.updatedAt = nowIso();
      logInfo("entries.cleared", { sessionId: session.id, actorParticipantId: participant.id });

      return { success: true };
    });
  },

  // Admin-only action-item creation for sprint follow-ups.
  async createActionItem(input: { slug: string; token: string; content: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");
      const participant = getParticipantByToken(store, input.token, session.id);
      assertAdmin(participant);

      const content = input.content.trim();
      if (!content) throw new Error("Action item content is required");

      const item: ActionItem = {
        id: randomUUID(),
        sessionId: session.id,
        createdByParticipantId: participant.id,
        content,
        createdAt: nowIso()
      };

      store.actionItems.push(item);
      session.updatedAt = nowIso();
      logInfo("action_item.created", { sessionId: session.id, actionItemId: item.id, actorParticipantId: participant.id });
      return item;
    });
  },

  // Admin-only action-item deletion.
  async deleteActionItem(input: { slug: string; token: string; actionItemId: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");
      const participant = getParticipantByToken(store, input.token, session.id);
      assertAdmin(participant);

      const exists = store.actionItems.some(
        (item) => item.id === input.actionItemId && item.sessionId === session.id
      );
      if (!exists) throw new Error("Action item not found");

      store.actionItems = store.actionItems.filter((item) => item.id !== input.actionItemId);
      session.updatedAt = nowIso();
      logInfo("action_item.deleted", {
        sessionId: session.id,
        actionItemId: input.actionItemId,
        actorParticipantId: participant.id
      });
      return { success: true };
    });
  },

  // Adds a vote and enforces per-participant vote limit.
  async addVote(input: { slug: string; token: string; entryId: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const participant = getParticipantByToken(store, input.token, session.id);
      const entry = store.entries.find((item) => item.id === input.entryId && item.sessionId === session.id);
      if (!entry) throw new Error("Entry not found");

      const existingVote = store.votes.find(
        (item) => item.sessionId === session.id && item.entryId === input.entryId && item.participantId === participant.id
      );
      if (existingVote) return { vote: existingVote, totalVotes: store.votes.filter((item) => item.entryId === entry.id).length };

      const usedVotes = store.votes.filter(
        (item) => item.sessionId === session.id && item.participantId === participant.id
      ).length;
      if (usedVotes >= VOTE_LIMIT_PER_PARTICIPANT) throw new Error("Vote limit reached");

      const vote: Vote = {
        id: randomUUID(),
        sessionId: session.id,
        entryId: entry.id,
        participantId: participant.id,
        value: 1,
        createdAt: nowIso()
      };

      store.votes.push(vote);
      session.updatedAt = nowIso();
      logInfo("vote.added", { sessionId: session.id, entryId: entry.id, participantId: participant.id });

      return { vote, totalVotes: store.votes.filter((item) => item.entryId === entry.id).length };
    });
  },

  // Removes the current participant's vote from one entry.
  async removeVote(input: { slug: string; token: string; entryId: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const participant = getParticipantByToken(store, input.token, session.id);
      const vote = store.votes.find(
        (item) => item.sessionId === session.id && item.entryId === input.entryId && item.participantId === participant.id
      );
      if (!vote) throw new Error("Vote not found");

      store.votes = store.votes.filter((item) => item.id !== vote.id);
      session.updatedAt = nowIso();
      logInfo("vote.removed", { sessionId: session.id, entryId: input.entryId, participantId: participant.id });

      return { success: true };
    });
  },

  // Saves or updates one participant's happiness score.
  async upsertHappiness(input: { slug: string; token: string; score: number }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const participant = getParticipantByToken(store, input.token, session.id);
      const now = nowIso();
      const existing = store.happinessChecks.find(
        (item) => item.sessionId === session.id && item.participantId === participant.id
      );

      if (existing) {
        existing.score = input.score;
        existing.updatedAt = now;
      } else {
        const next: HappinessCheck = {
          id: randomUUID(),
          sessionId: session.id,
          participantId: participant.id,
          score: input.score,
          createdAt: now,
          updatedAt: now
        };
        store.happinessChecks.push(next);
      }

      session.updatedAt = nowIso();
      logInfo("happiness.upserted", { sessionId: session.id, participantId: participant.id, score: input.score });
      return { success: true };
    });
  },

  // Creates a new group from two standalone entries.
  async createGroup(input: {
    slug: string;
    token: string;
    sourceEntryId: string;
    targetEntryId: string;
    name: string;
  }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");
      getParticipantByToken(store, input.token, session.id);

      const source = store.entries.find((entry) => entry.id === input.sourceEntryId && entry.sessionId === session.id);
      const target = store.entries.find((entry) => entry.id === input.targetEntryId && entry.sessionId === session.id);
      if (!source || !target) throw new Error("Entry not found");
      if (source.id === target.id) throw new Error("Cannot group same entry");
      if (source.type !== target.type) throw new Error("Entries must be on same side");
      if (source.groupId || target.groupId) throw new Error("Entries already grouped");

      const group: EntryGroup = {
        id: randomUUID(),
        sessionId: session.id,
        type: source.type,
        name: input.name.trim(),
        createdAt: nowIso()
      };
      source.groupId = group.id;
      target.groupId = group.id;
      store.groups.push(group);
      session.updatedAt = nowIso();
      logInfo("group.created", { sessionId: session.id, groupId: group.id });
      return group;
    });
  },

  // Adds a standalone entry to an existing group.
  async addEntryToGroup(input: { slug: string; token: string; groupId: string; entryId: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");
      getParticipantByToken(store, input.token, session.id);

      const group = store.groups.find((item) => item.id === input.groupId && item.sessionId === session.id);
      if (!group) throw new Error("Group not found");
      const entry = store.entries.find((item) => item.id === input.entryId && item.sessionId === session.id);
      if (!entry) throw new Error("Entry not found");
      if (entry.groupId) throw new Error("Entry already grouped");
      if (entry.type !== group.type) throw new Error("Entry side mismatch");

      entry.groupId = group.id;
      session.updatedAt = nowIso();
      logInfo("group.entry_added", { sessionId: session.id, groupId: group.id, entryId: entry.id });
      return { success: true };
    });
  },

  // Removes one entry from a group, auto-cleaning undersized groups.
  async ungroupEntry(input: { slug: string; token: string; entryId: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");
      getParticipantByToken(store, input.token, session.id);

      const entry = store.entries.find((item) => item.id === input.entryId && item.sessionId === session.id);
      if (!entry) throw new Error("Entry not found");
      if (!entry.groupId) return { success: true };

      const groupId = entry.groupId;
      entry.groupId = null;
      cleanupGroupIfSmall(store, groupId);
      session.updatedAt = nowIso();
      logInfo("group.entry_removed", { sessionId: session.id, groupId, entryId: entry.id });
      return { success: true };
    });
  },

  // Moves an entry between sides; grouped entries are detached first.
  async moveEntry(input: { slug: string; token: string; entryId: string; type: EntryType }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");
      getParticipantByToken(store, input.token, session.id);

      const entry = store.entries.find((item) => item.id === input.entryId && item.sessionId === session.id);
      if (!entry) throw new Error("Entry not found");

      if (entry.groupId) {
        const groupId = entry.groupId;
        entry.groupId = null;
        cleanupGroupIfSmall(store, groupId);
      }
      entry.type = input.type;
      session.updatedAt = nowIso();
      logInfo("entry.moved", { sessionId: session.id, entryId: entry.id, type: input.type });
      return { success: true };
    });
  },

  // Admin-only shared navigation update for all participants.
  async setNavigation(input: { slug: string; token: string; activeSection: Section; discussionEntryId?: string | null }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const participant = getParticipantByToken(store, input.token, session.id);
      assertAdmin(participant);

      const nav = getNavigation(store, session.id);
      nav.activeSection = input.activeSection;
      nav.discussionEntryId = input.discussionEntryId ?? null;
      nav.updatedAt = nowIso();

      if (input.activeSection === "discussion" || input.activeSection === "actions" || input.activeSection === "happiness") {
        session.phase = "discussing";
      } else if (input.activeSection === "done") {
        session.phase = "finished";
      } else {
        session.phase = "collecting";
      }

      session.updatedAt = nowIso();
      logInfo("navigation.updated", {
        sessionId: session.id,
        activeSection: input.activeSection,
        actorParticipantId: participant.id
      });

      return nav;
    });
  }
};
