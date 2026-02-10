import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AuthToken,
  Entry,
  EntryType,
  HappinessCheck,
  NavigationState,
  Participant,
  Section,
  Session,
  SessionStateResponse,
  StoreData,
  Vote
} from "@/lib/backend/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "retro-store.json");
const VOTE_LIMIT_PER_PARTICIPANT = 5;

let writeQueue: Promise<unknown> = Promise.resolve();

const createInitialData = (): StoreData => ({
  sessions: [],
  participants: [],
  entries: [],
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

  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as StoreData;
  } catch {
    const initial = createInitialData();
    await writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
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
  const authToken = store.authTokens.find((item) => item.token === token && item.sessionId === sessionId);
  if (!authToken) throw new Error("Unauthorized");

  const participant = store.participants.find((item) => item.id === authToken.participantId && item.sessionId === sessionId);
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

function sessionStateFromStore(store: StoreData, session: Session, viewer: Participant | null): SessionStateResponse {
  const viewerVotes = viewer
    ? store.votes.filter((vote) => vote.sessionId === session.id && vote.participantId === viewer.id)
    : [];
  const viewerVoteEntryIds = new Set(viewerVotes.map((vote) => vote.entryId));

  const participants = store.participants
    .filter((item) => item.sessionId === session.id)
    .map((item) => ({
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

  const sessionHappiness = store.happinessChecks.filter((item) => item.sessionId === session.id);
  const happinessTotal = sessionHappiness.reduce((sum, item) => sum + item.score, 0);
  const happinessAverage = sessionHappiness.length > 0 ? Number((happinessTotal / sessionHappiness.length).toFixed(2)) : null;

  return {
    session: {
      id: session.id,
      slug: session.slug,
      title: session.title,
      phase: session.phase,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    },
    participants,
    entries,
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
      count: sessionHappiness.length
    }
  };
}

export const backendStore = {
  async createSession(input: { title: string; adminName: string }) {
    return withStoreLock((store) => {
      const now = nowIso();
      const sessionId = randomUUID();
      const participantId = randomUUID();
      const session: Session = {
        id: sessionId,
        slug: buildSlug(input.title),
        title: input.title.trim(),
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

      const authToken: AuthToken = {
        token: randomUUID(),
        participantId,
        sessionId,
        createdAt: now
      };

      store.sessions.push(session);
      store.participants.push(participant);
      store.authTokens.push(authToken);
      store.navigation.push({
        sessionId,
        activeSection: "retro",
        discussionEntryId: null,
        updatedAt: now
      });

      return {
        session,
        participant,
        token: authToken.token,
        joinUrl: `/session/${session.slug}/join`
      };
    });
  },

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

      const authToken: AuthToken = {
        token: randomUUID(),
        participantId: participant.id,
        sessionId: session.id,
        createdAt: now
      };

      store.participants.push(participant);
      store.authTokens.push(authToken);

      return { participant, token: authToken.token, sessionSlug: session.slug };
    });
  },

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
        createdAt: nowIso()
      };

      store.entries.push(entry);
      session.updatedAt = nowIso();

      return entry;
    });
  },

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
      session.updatedAt = nowIso();

      return { success: true };
    });
  },

  async clearEntries(input: { slug: string; token: string }) {
    return withStoreLock((store) => {
      const session = getSessionBySlug(store, input.slug);
      if (!session) throw new Error("Session not found");

      const participant = getParticipantByToken(store, input.token, session.id);
      assertAdmin(participant);

      const sessionEntryIds = new Set(store.entries.filter((item) => item.sessionId === session.id).map((item) => item.id));
      store.entries = store.entries.filter((item) => item.sessionId !== session.id);
      store.votes = store.votes.filter((item) => !sessionEntryIds.has(item.entryId));
      session.updatedAt = nowIso();

      return { success: true };
    });
  },

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

      return { vote, totalVotes: store.votes.filter((item) => item.entryId === entry.id).length };
    });
  },

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

      return { success: true };
    });
  },

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
      return { success: true };
    });
  },

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

      if (input.activeSection === "discussion") {
        session.phase = "discussing";
      } else if (input.activeSection === "done") {
        session.phase = "finished";
      } else {
        session.phase = "collecting";
      }

      session.updatedAt = nowIso();

      return nav;
    });
  }
};
