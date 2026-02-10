import type { EntryType, Section, SessionStateResponse } from "@/lib/backend/types";

// Frontend API client for all session mutations/queries used by app/page.tsx.
type ApiError = { error?: string };

export type CreateSessionResult = {
  session: { slug: string };
  token: string;
};

export type JoinSessionResult = {
  token: string;
  sessionSlug: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function headers(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token ? { "x-participant-token": token } : {})
  };
}

function errorFromPayload(payload: ApiError, fallback: string) {
  return payload.error ?? fallback;
}

function toApiError(payload: unknown): ApiError {
  if (payload && typeof payload === "object" && "error" in payload) {
    return payload as ApiError;
  }
  return {};
}

export async function createSession(input: { title: string; adminName: string }): Promise<CreateSessionResult> {
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input)
  });
  const payload = await parseJson<CreateSessionResult | ApiError>(response);
  if (!response.ok || !("session" in payload)) {
    throw new Error(errorFromPayload(toApiError(payload), "Unable to create session"));
  }
  return payload;
}

export async function joinSession(slug: string, input: { name: string }): Promise<JoinSessionResult> {
  const response = await fetch(`/api/sessions/${slug}/join`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input)
  });
  const payload = await parseJson<JoinSessionResult | ApiError>(response);
  if (!response.ok || !("token" in payload)) {
    throw new Error(errorFromPayload(toApiError(payload), "Unable to join session"));
  }
  return payload;
}

export async function getSessionState(slug: string, token: string): Promise<SessionStateResponse> {
  const response = await fetch(`/api/sessions/${slug}/state`, {
    cache: "no-store",
    headers: headers(token)
  });
  const payload = await parseJson<SessionStateResponse | ApiError>(response);
  if (!response.ok || !("session" in payload)) {
    throw new Error(errorFromPayload(toApiError(payload), "Unable to load session"));
  }
  return payload;
}

async function authedRequest(path: string, token: string, init: RequestInit, fallback: string) {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...headers(token),
      ...(init.headers ?? {})
    }
  });

  const payload = await parseJson<ApiError>(response);
  if (!response.ok) throw new Error(errorFromPayload(payload, fallback));
}

export async function setNavigation(slug: string, token: string, input: { activeSection: Section; discussionEntryId?: string | null }) {
  await authedRequest(
    `/api/sessions/${slug}/navigation`,
    token,
    { method: "POST", body: JSON.stringify(input) },
    "Unable to update navigation"
  );
}

export async function createEntry(slug: string, token: string, input: { type: EntryType; content: string }) {
  await authedRequest(
    `/api/sessions/${slug}/entries`,
    token,
    { method: "POST", body: JSON.stringify(input) },
    "Unable to create entry"
  );
}

export async function deleteEntry(slug: string, token: string, entryId: string) {
  await authedRequest(`/api/sessions/${slug}/entries/${entryId}`, token, { method: "DELETE" }, "Unable to delete entry");
}

export async function voteEntry(slug: string, token: string, entryId: string) {
  await authedRequest(
    `/api/sessions/${slug}/votes`,
    token,
    { method: "POST", body: JSON.stringify({ entryId }) },
    "Unable to add vote"
  );
}

export async function unvoteEntry(slug: string, token: string, entryId: string) {
  await authedRequest(`/api/sessions/${slug}/votes/${entryId}`, token, { method: "DELETE" }, "Unable to remove vote");
}

export async function createGroup(slug: string, token: string, input: { sourceEntryId: string; targetEntryId: string; name: string }) {
  await authedRequest(
    `/api/sessions/${slug}/groups`,
    token,
    { method: "POST", body: JSON.stringify(input) },
    "Unable to create group"
  );
}

export async function addEntryToGroup(slug: string, token: string, groupId: string, entryId: string) {
  await authedRequest(
    `/api/sessions/${slug}/groups/${groupId}/entries`,
    token,
    { method: "POST", body: JSON.stringify({ entryId }) },
    "Unable to add entry to group"
  );
}

export async function ungroupEntry(slug: string, token: string, groupId: string, entryId: string) {
  await authedRequest(
    `/api/sessions/${slug}/groups/${groupId}/entries/${entryId}`,
    token,
    { method: "DELETE" },
    "Unable to ungroup entry"
  );
}

export async function moveEntry(slug: string, token: string, entryId: string, type: EntryType) {
  await authedRequest(
    `/api/sessions/${slug}/entries/${entryId}/move`,
    token,
    { method: "POST", body: JSON.stringify({ type }) },
    "Unable to move entry"
  );
}

export async function upsertHappiness(slug: string, token: string, score: number) {
  await authedRequest(
    `/api/sessions/${slug}/happiness`,
    token,
    { method: "POST", body: JSON.stringify({ score }) },
    "Unable to submit happiness"
  );
}
