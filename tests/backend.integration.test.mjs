import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import pg from "pg";

const { Client } = pg;

const PORT = Number(process.env.TEST_PORT ?? "4031");
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DATABASE_URL = process.env.DATABASE_URL?.trim();
let devServer;

function requireDatabaseUrl() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run backend integration tests");
  }
  return DATABASE_URL;
}

async function waitForServerReady() {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/sessions/nonexistent/state`);
      if (response.status >= 200) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Dev server did not become ready");
}

async function resetDatabase() {
  const client = new Client({
    connectionString: requireDatabaseUrl(),
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined
  });

  await client.connect();
  try {
    await client.query(`
      TRUNCATE TABLE
        votes,
        happiness_checks,
        action_items,
        entries,
        entry_groups,
        navigation,
        participants,
        sessions
      RESTART IDENTITY CASCADE
    `);
  } finally {
    await client.end();
  }
}

async function api(pathname, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers["x-participant-token"] = token;
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const payload = await response.json();
  return { status: response.status, payload };
}

before(async () => {
  requireDatabaseUrl();

  const migrate = spawnSync("node", ["scripts/db-migrate.mjs"], {
    env: process.env,
    stdio: "pipe",
    encoding: "utf8"
  });
  if (migrate.status !== 0) {
    throw new Error(`db:migrate failed: ${migrate.stderr || migrate.stdout}`);
  }

  await resetDatabase();

  devServer = spawn("npm", ["run", "dev", "--", "--port", String(PORT)], {
    env: process.env,
    stdio: "pipe"
  });

  await waitForServerReady();
});

after(async () => {
  if (!devServer) return;
  devServer.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
});

beforeEach(async () => {
  await resetDatabase();
});

async function createSessionAndUser() {
  const create = await api("/api/sessions", {
    method: "POST",
    body: { title: "Sprint 14 Retro", adminName: "Owner" }
  });

  assert.equal(create.status, 200);
  const slug = create.payload.session.slug;
  const adminToken = create.payload.token;

  const join = await api(`/api/sessions/${slug}/join`, {
    method: "POST",
    body: { name: "Alice" }
  });
  assert.equal(join.status, 200);

  return {
    slug,
    adminToken,
    userToken: join.payload.token,
    adminId: create.payload.participant.id,
    userId: join.payload.participant.id
  };
}

test("session lifecycle: create, join, and read state", async () => {
  const { slug, adminToken, userId } = await createSessionAndUser();

  const state = await api(`/api/sessions/${slug}/state`, { token: adminToken });
  assert.equal(state.status, 200);
  assert.equal(state.payload.session.phase, "collecting");
  assert.equal(state.payload.participants.length, 2);
  assert.equal(state.payload.viewer.isAdmin, true);
  assert.equal(state.payload.viewer.votesRemaining, 5);

  const participantIds = state.payload.participants.map((p) => p.id);
  assert.ok(participantIds.includes(userId));
});

test("entry permissions and admin clear behavior", async () => {
  const { slug, adminToken, userToken } = await createSessionAndUser();

  const adminEntry = await api(`/api/sessions/${slug}/entries`, {
    method: "POST",
    token: adminToken,
    body: { type: "went_right", content: "Strong release" }
  });
  assert.equal(adminEntry.status, 200);

  const userEntry = await api(`/api/sessions/${slug}/entries`, {
    method: "POST",
    token: userToken,
    body: { type: "went_wrong", content: "Unstable CI" }
  });
  assert.equal(userEntry.status, 200);

  const forbidDelete = await api(
    `/api/sessions/${slug}/entries/${adminEntry.payload.entry.id}`,
    { method: "DELETE", token: userToken }
  );
  assert.equal(forbidDelete.status, 403);

  const updateOwn = await api(
    `/api/sessions/${slug}/entries/${userEntry.payload.entry.id}`,
    {
      method: "PATCH",
      token: userToken,
      body: { content: "CI flakes after merge" }
    }
  );
  assert.equal(updateOwn.status, 200);
  assert.equal(updateOwn.payload.entry.content, "CI flakes after merge");

  const clearByAdmin = await api(`/api/sessions/${slug}/entries`, {
    method: "DELETE",
    token: adminToken
  });
  assert.equal(clearByAdmin.status, 200);

  const state = await api(`/api/sessions/${slug}/state`, { token: adminToken });
  assert.equal(state.payload.entries.length, 0);
});

test("voting supports idempotency and enforces 5-vote cap", async () => {
  const { slug, adminToken, userToken } = await createSessionAndUser();
  const entryIds = [];

  for (let i = 0; i < 6; i += 1) {
    const createEntry = await api(`/api/sessions/${slug}/entries`, {
      method: "POST",
      token: adminToken,
      body: { type: "went_right", content: `Entry ${i}` }
    });
    assert.equal(createEntry.status, 200);
    entryIds.push(createEntry.payload.entry.id);
  }

  const firstVote = await api(`/api/sessions/${slug}/votes`, {
    method: "POST",
    token: userToken,
    body: { entryId: entryIds[0] }
  });
  assert.equal(firstVote.status, 200);

  const idempotentVote = await api(`/api/sessions/${slug}/votes`, {
    method: "POST",
    token: userToken,
    body: { entryId: entryIds[0] }
  });
  assert.equal(idempotentVote.status, 200);
  assert.equal(idempotentVote.payload.vote.id, firstVote.payload.vote.id);

  for (let i = 1; i < 5; i += 1) {
    const vote = await api(`/api/sessions/${slug}/votes`, {
      method: "POST",
      token: userToken,
      body: { entryId: entryIds[i] }
    });
    assert.equal(vote.status, 200);
  }

  const overflowVote = await api(`/api/sessions/${slug}/votes`, {
    method: "POST",
    token: userToken,
    body: { entryId: entryIds[5] }
  });
  assert.equal(overflowVote.status, 409);
  assert.equal(overflowVote.payload.error, "Vote limit reached");

  const removeVote = await api(`/api/sessions/${slug}/votes/${entryIds[0]}`, {
    method: "DELETE",
    token: userToken
  });
  assert.equal(removeVote.status, 200);
});

test("navigation and happiness rules", async () => {
  const { slug, adminToken, userToken } = await createSessionAndUser();

  const nonAdminNavigation = await api(`/api/sessions/${slug}/navigation`, {
    method: "POST",
    token: userToken,
    body: { activeSection: "discussion" }
  });
  assert.equal(nonAdminNavigation.status, 403);

  const adminNavigation = await api(`/api/sessions/${slug}/navigation`, {
    method: "POST",
    token: adminToken,
    body: { activeSection: "discussion" }
  });
  assert.equal(adminNavigation.status, 200);

  const finishNavigation = await api(`/api/sessions/${slug}/navigation`, {
    method: "POST",
    token: adminToken,
    body: { activeSection: "done" }
  });
  assert.equal(finishNavigation.status, 200);

  const badHappiness = await api(`/api/sessions/${slug}/happiness`, {
    method: "POST",
    token: userToken,
    body: { score: 11 }
  });
  assert.equal(badHappiness.status, 400);

  const h1 = await api(`/api/sessions/${slug}/happiness`, {
    method: "POST",
    token: adminToken,
    body: { score: 8 }
  });
  const h2 = await api(`/api/sessions/${slug}/happiness`, {
    method: "POST",
    token: userToken,
    body: { score: 6 }
  });
  assert.equal(h1.status, 200);
  assert.equal(h2.status, 200);

  const state = await api(`/api/sessions/${slug}/state`, { token: adminToken });
  assert.equal(state.status, 200);
  assert.equal(state.payload.session.phase, "finished");
  assert.equal(state.payload.happiness.average, 7);
  assert.equal(state.payload.happiness.count, 2);
});

test("grouping, moving entries, and action-item admin checks", async () => {
  const { slug, adminToken, userToken } = await createSessionAndUser();

  const e1 = await api(`/api/sessions/${slug}/entries`, {
    method: "POST",
    token: adminToken,
    body: { type: "went_right", content: "Good handoff" }
  });
  const e2 = await api(`/api/sessions/${slug}/entries`, {
    method: "POST",
    token: adminToken,
    body: { type: "went_right", content: "Stable deploy" }
  });
  const e3 = await api(`/api/sessions/${slug}/entries`, {
    method: "POST",
    token: adminToken,
    body: { type: "went_wrong", content: "Slow tests" }
  });

  assert.equal(e1.status, 200);
  assert.equal(e2.status, 200);
  assert.equal(e3.status, 200);

  const group = await api(`/api/sessions/${slug}/groups`, {
    method: "POST",
    token: adminToken,
    body: {
      sourceEntryId: e1.payload.entry.id,
      targetEntryId: e2.payload.entry.id,
      name: "Delivery"
    }
  });
  assert.equal(group.status, 200);

  const mismatchGroup = await api(`/api/sessions/${slug}/groups/${group.payload.group.id}/entries`, {
    method: "POST",
    token: adminToken,
    body: { entryId: e3.payload.entry.id }
  });
  assert.equal(mismatchGroup.status, 400);

  const ungroup = await api(
    `/api/sessions/${slug}/groups/${group.payload.group.id}/entries/${e1.payload.entry.id}`,
    { method: "DELETE", token: adminToken }
  );
  assert.equal(ungroup.status, 200);

  const move = await api(`/api/sessions/${slug}/entries/${e2.payload.entry.id}/move`, {
    method: "POST",
    token: adminToken,
    body: { type: "went_wrong" }
  });
  assert.equal(move.status, 200);

  const userActionCreate = await api(`/api/sessions/${slug}/actions`, {
    method: "POST",
    token: userToken,
    body: { content: "Follow up CI" }
  });
  assert.equal(userActionCreate.status, 403);

  const adminActionCreate = await api(`/api/sessions/${slug}/actions`, {
    method: "POST",
    token: adminToken,
    body: { content: "Follow up CI" }
  });
  assert.equal(adminActionCreate.status, 200);

  const adminActionDelete = await api(
    `/api/sessions/${slug}/actions/${adminActionCreate.payload.actionItem.id}`,
    {
      method: "DELETE",
      token: adminToken
    }
  );
  assert.equal(adminActionDelete.status, 200);
});
