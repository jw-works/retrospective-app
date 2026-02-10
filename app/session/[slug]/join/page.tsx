"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type JoinResponse = {
  token: string;
};

const tokenKey = (slug: string) => `retro.token.${slug}`;

export default function JoinSessionPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const slug = params.slug;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slug) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${slug}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName })
      });
      const payload = (await response.json()) as JoinResponse | { error?: string };

      if (!response.ok || !("token" in payload)) {
        const message = "error" in payload ? payload.error : "Unable to join session";
        throw new Error(message || "Unable to join session");
      }

      localStorage.setItem(tokenKey(slug), payload.token);
      router.push(`/session/${slug}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to join session";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
      <div className="w-full rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-black">Join Session</h1>
        <p className="mt-2 text-sm text-black/70">Enter your name to join this retrospective session.</p>

        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-md border border-black/15 px-3 py-2"
            value={name}
            placeholder="Your name"
            onChange={(event) => setName(event.target.value)}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            className="w-full rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
            disabled={isSubmitting || !slug}
            type="submit"
          >
            {isSubmitting ? "Joining..." : "Join"}
          </button>
        </form>

        <Link className="mt-4 inline-block text-sm text-black/60 underline" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
