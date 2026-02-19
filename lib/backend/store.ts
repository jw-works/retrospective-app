import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { issueParticipantToken, verifyParticipantToken } from "@/lib/backend/auth";
import { logInfo } from "@/lib/backend/observability";
import type {
  ActionItem,
  Entry,
  EntryGroup,
  EntryType,
  NavigationState,
  Participant,
  Section,
  Session,
  SessionPhase,
  SessionStateResponse,
  Vote
} from "@/lib/backend/types";

const VOTE_LIMIT_PER_PARTICIPANT = 5;

const nowIso = () => new Date().toISOString();

const normalizeSlug = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);

const randomSegment = () => Math.random().toString(36).slice(2, 8);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const buildSlug = (title: string) => {
  const base = normalizeSlug(title) || "retro-session";
  return `${base}-${randomSegment()}`;
};

function normalizeDiscussionEntryId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = trimmed.includes(":") ? (trimmed.split(":").pop() ?? trimmed) : trimmed;
  if (!UUID_PATTERN.test(candidate)) {
    throw new Error("discussionEntryId is invalid");
  }
  return candidate;
}

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseUrl;
}

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
      ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const expectedTables = [
        "sessions",
        "participants",
        "entries",
        "entry_groups",
        "action_items",
        "votes",
        "happiness_checks",
        "navigation"
      ];

      const result = await getPool().query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
        [expectedTables]
      );

      if (result.rows.length !== expectedTables.length) {
        throw new Error("Database schema missing. Run npm run db:migrate");
      }
    })();
  }

  await schemaReady;
}

function toIso(input: string | Date): string {
  return new Date(input).toISOString();
}

function toSession(row: {
  id: string;
  slug: string;
  title: string;
  sprint_label: string | null;
  created_by_participant_id: string;
  phase: string;
  created_at: string | Date;
  updated_at: string | Date;
}): Session {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    sprintLabel: row.sprint_label,
    createdByParticipantId: row.created_by_participant_id,
    phase: row.phase as SessionPhase,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function toParticipant(row: {
  id: string;
  session_id: string;
  name: string;
  is_admin: boolean;
  created_at: string | Date;
}): Participant {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    isAdmin: row.is_admin,
    createdAt: toIso(row.created_at)
  };
}

function toEntry(row: {
  id: string;
  session_id: string;
  author_participant_id: string;
  type: string;
  content: string;
  group_id: string | null;
  created_at: string | Date;
}): Entry {
  return {
    id: row.id,
    sessionId: row.session_id,
    authorParticipantId: row.author_participant_id,
    type: row.type as EntryType,
    content: row.content,
    groupId: row.group_id,
    createdAt: toIso(row.created_at)
  };
}

function toGroup(row: {
  id: string;
  session_id: string;
  type: string;
  name: string;
  created_at: string | Date;
}): EntryGroup {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type as EntryType,
    name: row.name,
    createdAt: toIso(row.created_at)
  };
}

function toActionItem(row: {
  id: string;
  session_id: string;
  created_by_participant_id: string;
  content: string;
  created_at: string | Date;
}): ActionItem {
  return {
    id: row.id,
    sessionId: row.session_id,
    createdByParticipantId: row.created_by_participant_id,
    content: row.content,
    createdAt: toIso(row.created_at)
  };
}

function toVote(row: {
  id: string;
  session_id: string;
  entry_id: string;
  participant_id: string;
  value: number;
  created_at: string | Date;
}): Vote {
  return {
    id: row.id,
    sessionId: row.session_id,
    entryId: row.entry_id,
    participantId: row.participant_id,
    value: 1,
    createdAt: toIso(row.created_at)
  };
}

function toNavigation(row: {
  session_id: string;
  active_section: string;
  discussion_entry_id: string | null;
  updated_at: string | Date;
}): NavigationState {
  return {
    sessionId: row.session_id,
    activeSection: row.active_section as Section,
    discussionEntryId: row.discussion_entry_id,
    updatedAt: toIso(row.updated_at)
  };
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function querySessionBySlug(client: PoolClient, slug: string): Promise<Session> {
  const sessionResult = await client.query<{
    id: string;
    slug: string;
    title: string;
    sprint_label: string | null;
    created_by_participant_id: string;
    phase: string;
    created_at: string | Date;
    updated_at: string | Date;
  }>(
    `SELECT id, slug, title, sprint_label, created_by_participant_id, phase, created_at, updated_at
     FROM sessions
     WHERE slug = $1`,
    [slug]
  );
  if (sessionResult.rowCount !== 1) throw new Error("Session not found");
  return toSession(sessionResult.rows[0]);
}

async function querySessionById(client: PoolClient, sessionId: string): Promise<Session> {
  const sessionResult = await client.query<{
    id: string;
    slug: string;
    title: string;
    sprint_label: string | null;
    created_by_participant_id: string;
    phase: string;
    created_at: string | Date;
    updated_at: string | Date;
  }>(
    `SELECT id, slug, title, sprint_label, created_by_participant_id, phase, created_at, updated_at
     FROM sessions
     WHERE id = $1`,
    [sessionId]
  );
  if (sessionResult.rowCount !== 1) throw new Error("Session not found");
  return toSession(sessionResult.rows[0]);
}

async function getParticipantByToken(client: PoolClient, token: string, sessionId: string): Promise<Participant> {
  const decoded = verifyParticipantToken(token);
  if (decoded.sessionId !== sessionId) throw new Error("Unauthorized");

  const participantResult = await client.query<{
    id: string;
    session_id: string;
    name: string;
    is_admin: boolean;
    created_at: string | Date;
  }>(
    `SELECT id, session_id, name, is_admin, created_at
     FROM participants
     WHERE id = $1 AND session_id = $2`,
    [decoded.participantId, sessionId]
  );

  if (participantResult.rowCount !== 1) throw new Error("Unauthorized");
  return toParticipant(participantResult.rows[0]);
}

function assertAdmin(participant: Participant): void {
  if (!participant.isAdmin) throw new Error("Forbidden");
}

async function getNavigation(client: PoolClient, sessionId: string): Promise<NavigationState> {
  const navResult = await client.query<{
    session_id: string;
    active_section: string;
    discussion_entry_id: string | null;
    updated_at: string | Date;
  }>(
    `SELECT session_id, active_section, discussion_entry_id, updated_at
     FROM navigation
     WHERE session_id = $1`,
    [sessionId]
  );

  if (navResult.rowCount === 1) return toNavigation(navResult.rows[0]);

  const now = nowIso();
  await client.query(
    `INSERT INTO navigation (session_id, active_section, discussion_entry_id, updated_at)
     VALUES ($1, 'retro', NULL, $2)
     ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, now]
  );

  const insertedResult = await client.query<{
    session_id: string;
    active_section: string;
    discussion_entry_id: string | null;
    updated_at: string | Date;
  }>(
    `SELECT session_id, active_section, discussion_entry_id, updated_at
     FROM navigation
     WHERE session_id = $1`,
    [sessionId]
  );

  if (insertedResult.rowCount !== 1) throw new Error("Navigation not found");
  return toNavigation(insertedResult.rows[0]);
}

async function cleanupGroupIfSmall(client: PoolClient, groupId: string) {
  const countResult = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM entries
     WHERE group_id = $1`,
    [groupId]
  );

  const groupSize = Number(countResult.rows[0]?.count ?? "0");
  if (groupSize >= 2) return;

  await client.query(`UPDATE entries SET group_id = NULL WHERE group_id = $1`, [groupId]);
  await client.query(`DELETE FROM entry_groups WHERE id = $1`, [groupId]);
}

async function touchSession(client: PoolClient, sessionId: string, phase?: SessionPhase) {
  const now = nowIso();
  if (phase) {
    await client.query(`UPDATE sessions SET phase = $2, updated_at = $3 WHERE id = $1`, [sessionId, phase, now]);
    return;
  }

  await client.query(`UPDATE sessions SET updated_at = $2 WHERE id = $1`, [sessionId, now]);
}

async function buildSessionState(client: PoolClient, session: Session, viewer: Participant | null): Promise<SessionStateResponse> {
  type ParticipantRow = {
    id: string;
    name: string;
    is_admin: boolean;
    created_at: string | Date;
    vote_count: number;
  };

  type EntryStateRow = {
    id: string;
    session_id: string;
    author_participant_id: string;
    type: string;
    content: string;
    group_id: string | null;
    created_at: string | Date;
    votes: number;
    voted_by_viewer: number;
  };

  type GroupRow = {
    id: string;
    session_id: string;
    type: string;
    name: string;
    created_at: string | Date;
  };

  type ActionItemRow = {
    id: string;
    session_id: string;
    created_by_participant_id: string;
    content: string;
    created_at: string | Date;
  };

  const participantRows = await client.query<ParticipantRow>(
    `SELECT p.id, p.name, p.is_admin, p.created_at,
            COALESCE(v.vote_count, 0)::int AS vote_count
     FROM participants p
     LEFT JOIN (
       SELECT participant_id, COUNT(*) AS vote_count
       FROM votes
       WHERE session_id = $1
       GROUP BY participant_id
     ) v ON v.participant_id = p.id
     WHERE p.session_id = $1
     ORDER BY p.created_at ASC`,
    [session.id]
  );

  const entriesRows = await client.query<EntryStateRow>(
    `SELECT e.id, e.session_id, e.author_participant_id, e.type, e.content, e.group_id, e.created_at,
            COUNT(v.id)::int AS votes,
            COALESCE(MAX(CASE WHEN v.participant_id = $2 THEN 1 ELSE 0 END), 0)::int AS voted_by_viewer
     FROM entries e
     LEFT JOIN votes v ON v.entry_id = e.id
     WHERE e.session_id = $1
     GROUP BY e.id
     ORDER BY e.created_at ASC`,
    [session.id, viewer?.id ?? null]
  );

  const groupsRows = await client.query<GroupRow>(
    `SELECT id, session_id, type, name, created_at
     FROM entry_groups
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [session.id]
  );

  const actionRows = await client.query<ActionItemRow>(
    `SELECT id, session_id, created_by_participant_id, content, created_at
     FROM action_items
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [session.id]
  );

  const happinessSummary = await client.query<{ average: string | null; count: string; viewer_submitted: boolean }>(
    `SELECT ROUND(AVG(score)::numeric, 2)::text AS average,
            COUNT(*)::text AS count,
            COALESCE(BOOL_OR(participant_id = $2), false) AS viewer_submitted
     FROM happiness_checks
     WHERE session_id = $1`,
    [session.id, viewer?.id ?? null]
  );

  const navigation = await getNavigation(client, session.id);

  const participants = participantRows.rows.map((row) => {
    const votesUsed = Number(row.vote_count);
    return {
      id: row.id as string,
      name: row.name as string,
      isAdmin: Boolean(row.is_admin),
      createdAt: toIso(row.created_at as string | Date),
      votesUsed,
      votesRemaining: Math.max(0, VOTE_LIMIT_PER_PARTICIPANT - votesUsed)
    };
  });

  const entries = entriesRows.rows.map((row) => ({
    ...toEntry({
      id: row.id as string,
      session_id: row.session_id as string,
      author_participant_id: row.author_participant_id as string,
      type: row.type as string,
      content: row.content as string,
      group_id: row.group_id as string | null,
      created_at: row.created_at as string | Date
    }),
    votes: Number(row.votes),
    votedByViewer: Number(row.voted_by_viewer) > 0
  }));

  const groups = groupsRows.rows.map((row) =>
    toGroup({
      id: row.id as string,
      session_id: row.session_id as string,
      type: row.type as string,
      name: row.name as string,
      created_at: row.created_at as string | Date
    })
  );

  const actionItems = actionRows.rows.map((row) =>
    toActionItem({
      id: row.id as string,
      session_id: row.session_id as string,
      created_by_participant_id: row.created_by_participant_id as string,
      content: row.content as string,
      created_at: row.created_at as string | Date
    })
  );

  const happinessRow = happinessSummary.rows[0] ?? { average: null, count: "0", viewer_submitted: false };
  const happinessCount = Number(happinessRow.count);

  const viewerVotesUsed = viewer
    ? participants.find((participant) => participant.id === viewer.id)?.votesUsed ?? 0
    : 0;

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
    navigation,
    viewer: viewer
      ? {
          id: viewer.id,
          name: viewer.name,
          isAdmin: viewer.isAdmin,
          votesUsed: viewerVotesUsed,
          votesRemaining: Math.max(0, VOTE_LIMIT_PER_PARTICIPANT - viewerVotesUsed)
        }
      : null,
    happiness: {
      average: happinessCount > 0 && happinessRow.average !== null ? Number(happinessRow.average) : null,
      count: happinessCount,
      viewerSubmitted: Boolean(happinessRow.viewer_submitted)
    }
  };
}

export const backendStore = {
  async createSession(input: { title: string; adminName: string; sprintLabel?: string }) {
    return withTransaction(async (client) => {
      const title = input.title.trim();
      const adminName = input.adminName.trim();
      if (!title) throw new Error("title is required");
      if (!adminName) throw new Error("adminName is required");

      const now = nowIso();
      const sessionId = randomUUID();
      const participantId = randomUUID();

      let slug = buildSlug(title);
      while (true) {
        const existing = await client.query(`SELECT 1 FROM sessions WHERE slug = $1`, [slug]);
        if (existing.rowCount === 0) break;
        slug = buildSlug(title);
      }

      await client.query(
        `INSERT INTO sessions (id, slug, title, sprint_label, created_by_participant_id, phase, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'collecting', $6, $6)`,
        [sessionId, slug, title, input.sprintLabel?.trim() || null, participantId, now]
      );

      await client.query(
        `INSERT INTO participants (id, session_id, name, is_admin, created_at)
         VALUES ($1, $2, $3, true, $4)`,
        [participantId, sessionId, adminName, now]
      );

      await client.query(
        `INSERT INTO navigation (session_id, active_section, discussion_entry_id, updated_at)
         VALUES ($1, 'retro', NULL, $2)`,
        [sessionId, now]
      );

      const session = await querySessionById(client, sessionId);
      const participantResult = await client.query(
        `SELECT id, session_id, name, is_admin, created_at FROM participants WHERE id = $1`,
        [participantId]
      );
      const participant = toParticipant(participantResult.rows[0]);
      const token = issueParticipantToken({ participantId, sessionId });

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

  async joinSession(input: { slug: string; name: string }) {
    return withTransaction(async (client) => {
      const name = input.name.trim();
      if (!name) throw new Error("name is required");
      const session = await querySessionBySlug(client, input.slug);
      const participantId = randomUUID();
      const now = nowIso();

      await client.query(
        `INSERT INTO participants (id, session_id, name, is_admin, created_at)
         VALUES ($1, $2, $3, false, $4)`,
        [participantId, session.id, name, now]
      );

      const participantResult = await client.query(
        `SELECT id, session_id, name, is_admin, created_at FROM participants WHERE id = $1`,
        [participantId]
      );

      const participant = toParticipant(participantResult.rows[0]);
      const token = issueParticipantToken({ participantId: participant.id, sessionId: session.id });

      logInfo("session.joined", {
        sessionId: session.id,
        sessionSlug: session.slug,
        participantId: participant.id
      });

      return { participant, token, sessionSlug: session.slug };
    });
  },

  async getSessionState(input: { slug: string; token?: string | null }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);

      let viewer: Participant | null = null;
      if (input.token) {
        viewer = await getParticipantByToken(client, input.token, session.id);
      }

      return buildSessionState(client, session, viewer);
    });
  },

  async createEntry(input: { slug: string; token: string; type: EntryType; content: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);

      const entryId = randomUUID();
      const now = nowIso();
      await client.query(
        `INSERT INTO entries (id, session_id, author_participant_id, type, content, group_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NULL, $6)`,
        [entryId, session.id, participant.id, input.type, input.content.trim(), now]
      );
      await touchSession(client, session.id);

      const entryResult = await client.query(
        `SELECT id, session_id, author_participant_id, type, content, group_id, created_at
         FROM entries
         WHERE id = $1`,
        [entryId]
      );

      logInfo("entry.created", { sessionId: session.id, entryId, authorParticipantId: participant.id });
      return toEntry(entryResult.rows[0]);
    });
  },

  async deleteEntry(input: { slug: string; token: string; entryId: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);

      const entryResult = await client.query(
        `SELECT id, session_id, author_participant_id, group_id
         FROM entries
         WHERE id = $1 AND session_id = $2`,
        [input.entryId, session.id]
      );
      if (entryResult.rowCount !== 1) throw new Error("Entry not found");
      const entry = entryResult.rows[0];

      if (!participant.isAdmin && entry.author_participant_id !== participant.id) {
        throw new Error("Forbidden");
      }

      await client.query(`DELETE FROM entries WHERE id = $1`, [entry.id]);
      if (entry.group_id) {
        await cleanupGroupIfSmall(client, entry.group_id as string);
      }
      await touchSession(client, session.id);

      logInfo("entry.deleted", { sessionId: session.id, entryId: entry.id, actorParticipantId: participant.id });
      return { success: true };
    });
  },

  async updateEntry(input: { slug: string; token: string; entryId: string; content: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);

      const entryResult = await client.query(
        `SELECT id, session_id, author_participant_id
         FROM entries
         WHERE id = $1 AND session_id = $2`,
        [input.entryId, session.id]
      );
      if (entryResult.rowCount !== 1) throw new Error("Entry not found");
      const entry = entryResult.rows[0];

      if (!participant.isAdmin && entry.author_participant_id !== participant.id) {
        throw new Error("Forbidden");
      }

      const nextContent = input.content.trim();
      if (!nextContent) throw new Error("Entry content is required");

      await client.query(`UPDATE entries SET content = $2 WHERE id = $1`, [entry.id, nextContent]);
      await touchSession(client, session.id);

      const updatedResult = await client.query(
        `SELECT id, session_id, author_participant_id, type, content, group_id, created_at
         FROM entries
         WHERE id = $1`,
        [entry.id]
      );

      logInfo("entry.updated", { sessionId: session.id, entryId: entry.id, actorParticipantId: participant.id });
      return toEntry(updatedResult.rows[0]);
    });
  },

  async clearEntries(input: { slug: string; token: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);
      assertAdmin(participant);

      await client.query(`DELETE FROM entries WHERE session_id = $1`, [session.id]);
      await client.query(`DELETE FROM entry_groups WHERE session_id = $1`, [session.id]);
      await touchSession(client, session.id);

      logInfo("entries.cleared", { sessionId: session.id, actorParticipantId: participant.id });
      return { success: true };
    });
  },

  async createActionItem(input: { slug: string; token: string; content: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);
      assertAdmin(participant);

      const content = input.content.trim();
      if (!content) throw new Error("Action item content is required");

      const actionItemId = randomUUID();
      const now = nowIso();

      await client.query(
        `INSERT INTO action_items (id, session_id, created_by_participant_id, content, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [actionItemId, session.id, participant.id, content, now]
      );
      await touchSession(client, session.id);

      const itemResult = await client.query(
        `SELECT id, session_id, created_by_participant_id, content, created_at
         FROM action_items
         WHERE id = $1`,
        [actionItemId]
      );

      logInfo("action_item.created", {
        sessionId: session.id,
        actionItemId,
        actorParticipantId: participant.id
      });

      return toActionItem(itemResult.rows[0]);
    });
  },

  async deleteActionItem(input: { slug: string; token: string; actionItemId: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);
      assertAdmin(participant);

      const deleted = await client.query(
        `DELETE FROM action_items
         WHERE id = $1 AND session_id = $2
         RETURNING id`,
        [input.actionItemId, session.id]
      );

      if (deleted.rowCount !== 1) throw new Error("Action item not found");
      await touchSession(client, session.id);

      logInfo("action_item.deleted", {
        sessionId: session.id,
        actionItemId: input.actionItemId,
        actorParticipantId: participant.id
      });

      return { success: true };
    });
  },

  async addVote(input: { slug: string; token: string; entryId: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);
      await client.query(`SELECT id FROM participants WHERE id = $1 FOR UPDATE`, [participant.id]);

      const entryResult = await client.query(
        `SELECT id
         FROM entries
         WHERE id = $1 AND session_id = $2`,
        [input.entryId, session.id]
      );
      if (entryResult.rowCount !== 1) throw new Error("Entry not found");

      const existingVoteResult = await client.query(
        `SELECT id, session_id, entry_id, participant_id, value, created_at
         FROM votes
         WHERE session_id = $1 AND entry_id = $2 AND participant_id = $3`,
        [session.id, input.entryId, participant.id]
      );

      if (existingVoteResult.rowCount === 1) {
        const totalVotesResult = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM votes WHERE entry_id = $1`,
          [input.entryId]
        );
        return {
          vote: toVote(existingVoteResult.rows[0]),
          totalVotes: Number(totalVotesResult.rows[0]?.count ?? "0")
        };
      }

      const usedVotesResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM votes
         WHERE session_id = $1 AND participant_id = $2`,
        [session.id, participant.id]
      );
      const usedVotes = Number(usedVotesResult.rows[0]?.count ?? "0");
      if (usedVotes >= VOTE_LIMIT_PER_PARTICIPANT) throw new Error("Vote limit reached");

      const voteId = randomUUID();
      const now = nowIso();
      await client.query(
        `INSERT INTO votes (id, session_id, entry_id, participant_id, value, created_at)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        [voteId, session.id, input.entryId, participant.id, now]
      );
      await touchSession(client, session.id);

      const voteResult = await client.query(
        `SELECT id, session_id, entry_id, participant_id, value, created_at
         FROM votes
         WHERE id = $1`,
        [voteId]
      );
      const totalVotesResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM votes WHERE entry_id = $1`,
        [input.entryId]
      );

      logInfo("vote.added", { sessionId: session.id, entryId: input.entryId, participantId: participant.id });

      return {
        vote: toVote(voteResult.rows[0]),
        totalVotes: Number(totalVotesResult.rows[0]?.count ?? "0")
      };
    });
  },

  async removeVote(input: { slug: string; token: string; entryId: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);

      const deleted = await client.query(
        `DELETE FROM votes
         WHERE session_id = $1 AND entry_id = $2 AND participant_id = $3
         RETURNING id`,
        [session.id, input.entryId, participant.id]
      );

      if (deleted.rowCount !== 1) throw new Error("Vote not found");
      await touchSession(client, session.id);

      logInfo("vote.removed", { sessionId: session.id, entryId: input.entryId, participantId: participant.id });
      return { success: true };
    });
  },

  async upsertHappiness(input: { slug: string; token: string; score: number }) {
    return withTransaction(async (client) => {
      if (!Number.isFinite(input.score) || input.score < 1 || input.score > 10) {
        throw new Error("score must be between 1 and 10");
      }
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);

      const now = nowIso();
      const existingResult = await client.query(
        `SELECT id, session_id, participant_id, score, created_at, updated_at
         FROM happiness_checks
         WHERE session_id = $1 AND participant_id = $2`,
        [session.id, participant.id]
      );

      if (existingResult.rowCount === 1) {
        await client.query(
          `UPDATE happiness_checks
           SET score = $3, updated_at = $4
           WHERE session_id = $1 AND participant_id = $2`,
          [session.id, participant.id, input.score, now]
        );
      } else {
        await client.query(
          `INSERT INTO happiness_checks (id, session_id, participant_id, score, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [randomUUID(), session.id, participant.id, input.score, now]
        );
      }

      await touchSession(client, session.id);
      logInfo("happiness.upserted", { sessionId: session.id, participantId: participant.id, score: input.score });
      return { success: true };
    });
  },

  async createGroup(input: {
    slug: string;
    token: string;
    sourceEntryId: string;
    targetEntryId: string;
    name: string;
  }) {
    return withTransaction(async (client) => {
      const name = input.name.trim();
      if (!name) throw new Error("Group name is required");
      const session = await querySessionBySlug(client, input.slug);
      await getParticipantByToken(client, input.token, session.id);

      type GroupCandidateRow = {
        id: string;
        type: EntryType;
        group_id: string | null;
      };

      const entriesResult = await client.query<GroupCandidateRow>(
        `SELECT id, type, group_id
         FROM entries
         WHERE session_id = $1 AND id = ANY($2::uuid[])`,
        [session.id, [input.sourceEntryId, input.targetEntryId]]
      );
      const source = entriesResult.rows.find((row) => row.id === input.sourceEntryId);
      const target = entriesResult.rows.find((row) => row.id === input.targetEntryId);

      if (!source || !target) throw new Error("Entry not found");
      if (source.id === target.id) throw new Error("Cannot group same entry");
      if (source.type !== target.type) throw new Error("Entries must be on same side");
      if (source.group_id || target.group_id) throw new Error("Entries already grouped");

      const groupId = randomUUID();
      const now = nowIso();
      await client.query(
        `INSERT INTO entry_groups (id, session_id, type, name, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [groupId, session.id, source.type, name, now]
      );

      await client.query(`UPDATE entries SET group_id = $2 WHERE id = $1`, [source.id, groupId]);
      await client.query(`UPDATE entries SET group_id = $2 WHERE id = $1`, [target.id, groupId]);
      await touchSession(client, session.id);

      const groupResult = await client.query(
        `SELECT id, session_id, type, name, created_at
         FROM entry_groups
         WHERE id = $1`,
        [groupId]
      );

      logInfo("group.created", { sessionId: session.id, groupId });
      return toGroup(groupResult.rows[0]);
    });
  },

  async addEntryToGroup(input: { slug: string; token: string; groupId: string; entryId: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      await getParticipantByToken(client, input.token, session.id);

      const groupResult = await client.query(
        `SELECT id, type
         FROM entry_groups
         WHERE id = $1 AND session_id = $2`,
        [input.groupId, session.id]
      );
      if (groupResult.rowCount !== 1) throw new Error("Group not found");
      const group = groupResult.rows[0];

      const entryResult = await client.query(
        `SELECT id, type, group_id
         FROM entries
         WHERE id = $1 AND session_id = $2`,
        [input.entryId, session.id]
      );
      if (entryResult.rowCount !== 1) throw new Error("Entry not found");
      const entry = entryResult.rows[0];

      if (entry.group_id) throw new Error("Entry already grouped");
      if (entry.type !== group.type) throw new Error("Entry side mismatch");

      await client.query(`UPDATE entries SET group_id = $2 WHERE id = $1`, [entry.id, group.id]);
      await touchSession(client, session.id);

      logInfo("group.entry_added", { sessionId: session.id, groupId: group.id, entryId: entry.id });
      return { success: true };
    });
  },

  async ungroupEntry(input: { slug: string; token: string; entryId: string }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      await getParticipantByToken(client, input.token, session.id);

      const entryResult = await client.query(
        `SELECT id, group_id
         FROM entries
         WHERE id = $1 AND session_id = $2`,
        [input.entryId, session.id]
      );
      if (entryResult.rowCount !== 1) throw new Error("Entry not found");
      const entry = entryResult.rows[0];
      if (!entry.group_id) return { success: true };

      await client.query(`UPDATE entries SET group_id = NULL WHERE id = $1`, [entry.id]);
      await cleanupGroupIfSmall(client, entry.group_id as string);
      await touchSession(client, session.id);

      logInfo("group.entry_removed", { sessionId: session.id, groupId: entry.group_id, entryId: entry.id });
      return { success: true };
    });
  },

  async moveEntry(input: { slug: string; token: string; entryId: string; type: EntryType }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      await getParticipantByToken(client, input.token, session.id);

      const entryResult = await client.query(
        `SELECT id, group_id
         FROM entries
         WHERE id = $1 AND session_id = $2`,
        [input.entryId, session.id]
      );
      if (entryResult.rowCount !== 1) throw new Error("Entry not found");
      const entry = entryResult.rows[0];

      if (entry.group_id) {
        await client.query(`UPDATE entries SET group_id = NULL WHERE id = $1`, [entry.id]);
        await cleanupGroupIfSmall(client, entry.group_id as string);
      }

      await client.query(`UPDATE entries SET type = $2 WHERE id = $1`, [entry.id, input.type]);
      await touchSession(client, session.id);

      logInfo("entry.moved", { sessionId: session.id, entryId: entry.id, type: input.type });
      return { success: true };
    });
  },

  async setNavigation(input: { slug: string; token: string; activeSection: Section; discussionEntryId?: string | null }) {
    return withTransaction(async (client) => {
      const session = await querySessionBySlug(client, input.slug);
      const participant = await getParticipantByToken(client, input.token, session.id);
      assertAdmin(participant);
      const discussionEntryId = normalizeDiscussionEntryId(input.discussionEntryId);

      const now = nowIso();
      await client.query(
        `INSERT INTO navigation (session_id, active_section, discussion_entry_id, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id)
         DO UPDATE SET
           active_section = EXCLUDED.active_section,
           discussion_entry_id = EXCLUDED.discussion_entry_id,
           updated_at = EXCLUDED.updated_at`,
        [session.id, input.activeSection, discussionEntryId, now]
      );

      let nextPhase: SessionPhase;
      if (
        input.activeSection === "discussion" ||
        input.activeSection === "actions" ||
        input.activeSection === "happiness"
      ) {
        nextPhase = "discussing";
      } else if (input.activeSection === "done") {
        nextPhase = "finished";
      } else {
        nextPhase = "collecting";
      }
      await touchSession(client, session.id, nextPhase);

      const nav = await getNavigation(client, session.id);
      logInfo("navigation.updated", {
        sessionId: session.id,
        activeSection: input.activeSection,
        actorParticipantId: participant.id
      });

      return nav;
    });
  }
};
