"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { EntryType, Section, SessionStateResponse } from "@/lib/backend/types";

type ApiResponseWithError = {
  error?: string;
};

type SessionState = SessionStateResponse;

const tokenKey = (slug: string) => `retro.token.${slug}`;

export default function SessionPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("went_right");
  const [happiness, setHappiness] = useState(7);

  const token = useMemo(() => {
    if (!slug || typeof window === "undefined") return "";
    return localStorage.getItem(tokenKey(slug)) ?? "";
  }, [slug]);

  const loadState = useCallback(async () => {
    if (!slug) return;

    try {
      const response = await fetch(`/api/sessions/${slug}/state`, { cache: "no-store" });
      const payload = (await response.json()) as SessionState | ApiResponseWithError;
      if (!response.ok || !("session" in payload)) {
        throw new Error("error" in payload ? payload.error : "Unable to load session state");
      }
      setState(payload);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load session state";
      setError(message);
    }
  }, [slug]);

  useEffect(() => {
    loadState();
    const interval = setInterval(loadState, 3000);
    return () => clearInterval(interval);
  }, [loadState]);

  const authedFetch = async (url: string, options: RequestInit = {}) => {
    if (!token) throw new Error("Missing session token. Join again from the invite link.");

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-participant-token": token,
        ...(options.headers ?? {})
      }
    });

    const payload = (await response.json()) as ApiResponseWithError;
    if (!response.ok) throw new Error(payload.error ?? "Request failed");
    await loadState();
  };

  const submitEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    try {
      await authedFetch(`/api/sessions/${slug}/entries`, {
        method: "POST",
        body: JSON.stringify({ type: entryType, content: trimmed })
      });
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create entry");
    }
  };

  const vote = async (entryId: string) => {
    try {
      await authedFetch(`/api/sessions/${slug}/votes`, {
        method: "POST",
        body: JSON.stringify({ entryId })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to vote");
    }
  };

  const submitHappiness = async () => {
    try {
      await authedFetch(`/api/sessions/${slug}/happiness`, {
        method: "POST",
        body: JSON.stringify({ score: happiness })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit happiness");
    }
  };

  const navigateSection = async (activeSection: Section) => {
    try {
      await authedFetch(`/api/sessions/${slug}/navigation`, {
        method: "POST",
        body: JSON.stringify({ activeSection })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to navigate");
    }
  };

  const deleteAllEntries = async () => {
    try {
      await authedFetch(`/api/sessions/${slug}/entries`, { method: "DELETE" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete entries");
    }
  };

  if (!slug) return null;

  return (
    <main className="mx-auto my-10 max-w-3xl px-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Session {slug}</h1>
        <Link className="text-sm underline" href={`/session/${slug}/join`}>
          Rejoin
        </Link>
      </div>

      {error ? <p className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-red-700">{error}</p> : null}

      {!state ? (
        <p>Loading session...</p>
      ) : (
        <>
          <section className="mb-6 rounded border border-black/10 p-4">
            <h2 className="font-medium">Participants</h2>
            <ul className="mt-3 list-disc pl-5">
              {state.participants.map((person) => (
                <li key={person.id}>
                  {person.name}
                  {person.isAdmin ? " (admin)" : ""}
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-6 rounded border border-black/10 p-4">
            <h2 className="font-medium">Add Entry</h2>
            <form className="mt-3 space-y-2" onSubmit={submitEntry}>
              <select
                className="rounded border border-black/15 px-2 py-1"
                value={entryType}
                onChange={(event) => setEntryType(event.target.value as EntryType)}
              >
                <option value="went_right">Went right</option>
                <option value="went_wrong">Went wrong</option>
              </select>
              <textarea
                className="block w-full rounded border border-black/15 px-2 py-1"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write your entry"
              />
              <button className="rounded bg-black px-3 py-1.5 text-white" type="submit">
                Add entry
              </button>
            </form>
          </section>

          <section className="mb-6 rounded border border-black/10 p-4">
            <h2 className="font-medium">Entries</h2>
            <ul className="mt-3 space-y-2">
              {state.entries.map((entry) => (
                <li className="rounded border border-black/10 p-3" key={entry.id}>
                  <p className="text-sm text-black/60">{entry.type === "went_right" ? "Went right" : "Went wrong"}</p>
                  <p>{entry.content}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button className="rounded border px-2 py-1 text-sm" onClick={() => vote(entry.id)} type="button">
                      Vote ({entry.votes})
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-6 rounded border border-black/10 p-4">
            <h2 className="font-medium">Admin Navigation</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded border px-2 py-1 text-sm" onClick={() => navigateSection("retro")} type="button">
                Retro
              </button>
              <button
                className="rounded border px-2 py-1 text-sm"
                onClick={() => navigateSection("discussion")}
                type="button"
              >
                Discussion
              </button>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => navigateSection("happiness")} type="button">
                Happiness
              </button>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => navigateSection("done")} type="button">
                Done
              </button>
            </div>
            <p className="mt-2 text-sm text-black/70">Current section: {state.navigation.activeSection}</p>
            <button className="mt-3 rounded border px-2 py-1 text-sm" onClick={deleteAllEntries} type="button">
              Delete all entries (admin)
            </button>
          </section>

          <section className="rounded border border-black/10 p-4">
            <h2 className="font-medium">Happiness</h2>
            <div className="mt-3 flex items-center gap-3">
              <input
                max={10}
                min={1}
                onChange={(event) => setHappiness(Number(event.target.value))}
                type="range"
                value={happiness}
              />
              <span>{happiness}</span>
              <button className="rounded border px-2 py-1 text-sm" onClick={submitHappiness} type="button">
                Submit
              </button>
            </div>
            <p className="mt-2 text-sm text-black/70">
              Average happiness: {state.happiness.average ?? "N/A"} ({state.happiness.count} responses)
            </p>
          </section>
        </>
      )}
    </main>
  );
}
