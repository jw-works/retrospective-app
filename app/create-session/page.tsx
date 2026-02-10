"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type CreateSessionPayload = {
  session: {
    slug: string;
    title: string;
    joinUrl: string;
  };
  token: string;
};

const tokenKey = (slug: string) => `retro.token.${slug}`;

export default function CreateSessionPage() {
  const [title, setTitle] = useState("");
  const [adminName, setAdminName] = useState("");
  const [created, setCreated] = useState<CreateSessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), adminName: adminName.trim() })
      });
      const payload = (await response.json()) as CreateSessionPayload | { error?: string };

      if (!response.ok || !("session" in payload) || !("token" in payload)) {
        const message = "error" in payload ? payload.error : "Unable to create session";
        throw new Error(message || "Unable to create session");
      }

      localStorage.setItem(tokenKey(payload.session.slug), payload.token);
      setCreated(payload);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create session";
      setError(message);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <div className="w-full rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-black">Create Session</h1>
        <p className="mt-2 text-sm text-black/70">Create a retrospective room and share the join link.</p>

        <form className="mt-5 space-y-3" onSubmit={submit}>
          <input
            className="w-full rounded border border-black/15 px-3 py-2"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Session title"
            value={title}
          />
          <input
            className="w-full rounded border border-black/15 px-3 py-2"
            onChange={(event) => setAdminName(event.target.value)}
            placeholder="Admin name"
            value={adminName}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="w-full rounded bg-black px-3 py-2 text-white" type="submit">
            Create
          </button>
        </form>

        {created ? (
          <div className="mt-5 rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
            <p>
              Join link: <code>{created.session.joinUrl}</code>
            </p>
            <div className="mt-2 flex gap-2">
              <Link className="rounded border px-2 py-1" href={created.session.joinUrl}>
                Open join page
              </Link>
              <Link className="rounded border px-2 py-1" href={`/session/${created.session.slug}`}>
                Open session
              </Link>
            </div>
          </div>
        ) : null}

        <Link className="mt-4 inline-block text-sm underline" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
