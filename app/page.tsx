"use client";

import { useState } from "react";

const people = [
  { name: "Annabel", online: true },
  { name: "Mo", online: true },
  { name: "Priya", online: false },
  { name: "Sam", online: false }
];

type RetroItem = {
  id: string;
  text: string;
  votes: number;
  voted: boolean;
  ts: number;
};

const seededRight: RetroItem[] = [
  {
    id: "right-1",
    text: "Release shipped on time, idk whats happening but its very sad to see teams not coordinating",
    votes: 2,
    voted: false,
    ts: Date.now() - 300000
  },
  {
    id: "right-2",
    text: "Support tickets down 18%",
    votes: 1,
    voted: false,
    ts: Date.now() - 240000
  },
  {
    id: "right-3",
    text: "Faster code reviews",
    votes: 0,
    voted: false,
    ts: Date.now() - 180000
  }
];

const seededWrong: RetroItem[] = [
  {
    id: "wrong-1",
    text: "Build flakiness on CI",
    votes: 3,
    voted: false,
    ts: Date.now() - 360000
  },
  {
    id: "wrong-2",
    text: "Late scope changes",
    votes: 1,
    voted: false,
    ts: Date.now() - 200000
  },
  {
    id: "wrong-3",
    text: "Missing handover docs",
    votes: 0,
    voted: false,
    ts: Date.now() - 120000
  }
];

const sortItems = (items: RetroItem[]) => [...items].sort((a, b) => b.votes - a.votes || b.ts - a.ts);

export default function Home() {
  const [wentRightInput, setWentRightInput] = useState("");
  const [wentWrongInput, setWentWrongInput] = useState("");
  const [wentRightItems, setWentRightItems] = useState<RetroItem[]>(seededRight);
  const [wentWrongItems, setWentWrongItems] = useState<RetroItem[]>(seededWrong);

  const addWentRight = () => {
    const next = wentRightInput.trim();
    if (!next) return;
    setWentRightItems((current) => [
      ...current,
      { id: `right-${Date.now()}`, text: next, votes: 0, voted: false, ts: Date.now() }
    ]);
    setWentRightInput("");
  };

  const addWentWrong = () => {
    const next = wentWrongInput.trim();
    if (!next) return;
    setWentWrongItems((current) => [
      ...current,
      { id: `wrong-${Date.now()}`, text: next, votes: 0, voted: false, ts: Date.now() }
    ]);
    setWentWrongInput("");
  };

  const toggleVote = (side: "right" | "wrong", id: string) => {
    const update = (items: RetroItem[]) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const voted = !item.voted;
        return { ...item, voted, votes: Math.max(0, item.votes + (voted ? 1 : -1)) };
      });

    if (side === "right") setWentRightItems((current) => update(current));
    if (side === "wrong") setWentWrongItems((current) => update(current));
  };

  const removeItem = (side: "right" | "wrong", id: string) => {
    if (side === "right") setWentRightItems((current) => current.filter((item) => item.id !== id));
    if (side === "wrong") setWentWrongItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <main className="mx-auto my-12 max-w-[980px] px-7 max-[840px]:my-7">
      <header className="mb-7 flex items-center justify-between text-sm text-[#6f757d]">
        <div className="flex items-center gap-[18px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-black/6 bg-white/35 px-3 py-2 text-[#5f656d] backdrop-blur-md before:size-1.5 before:rounded-full before:bg-[#c9ccd1] before:content-['']">
            Retro
          </span>
          <span>This week</span>
        </div>
        <span
          aria-hidden
          className="size-[34px] rounded-full border border-black/6 bg-gradient-to-b from-[#f7f7f8] to-[#dedfe2] shadow-[0_10px_22px_rgba(0,0,0,0.07)]"
        />
      </header>

      <section className="my-[14px] mb-[26px]">
        <h1 className="m-0 text-[34px] leading-[1.15] font-medium text-[#3a3d41]">Team Retrospective</h1>
        <p className="mt-2.5 text-lg text-[#6f757d]">
          Capture what went right, what went wrong, and who&apos;s online.
        </p>
      </section>

      <section className="grid grid-cols-[1.2fr_1.2fr_0.9fr] items-stretch gap-[22px] max-[840px]:grid-cols-1">
        <section className="relative min-h-[220px] overflow-hidden rounded-[18px] border border-black/6 bg-[#eeeeef] p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-[''] max-[840px]:min-h-[200px]">
          <h2 className="m-0 text-lg font-medium text-[#51555b]">What went right</h2>
          <div className="mt-[14px]">
            <div className="relative">
              <input
                className="block h-[42px] w-full rounded-[10px] border border-black/6 bg-white/45 px-3 pr-11 text-[#565b62] placeholder:text-[#9aa0a6]"
                type="text"
                placeholder="Type and press enter"
                value={wentRightInput}
                onChange={(event) => setWentRightInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addWentRight();
                  }
                }}
              />
              <button
                type="button"
                aria-label="Add"
                onClick={addWentRight}
                className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-[10px] border border-black/6 bg-white/55 text-[#6a7078] active:translate-y-[calc(-50%+1px)]"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2.2]">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
          <ul className="mt-[14px] flex list-none flex-col gap-2.5 p-0" aria-label="What went right list">
            {sortItems(wentRightItems).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-[14px] border border-black/6 bg-white/28 px-3 py-3 text-sm text-[#4f545a]"
              >
                <span className="min-w-full flex-1 whitespace-normal pr-1.5 leading-[1.35]">{item.text}</span>
                <span className="ml-auto inline-flex items-center gap-2">
                  <span className="min-w-5 text-right text-xs text-[#7a8088]">{item.votes}</span>
                  <button
                    type="button"
                    aria-label="Upvote"
                    aria-pressed={item.voted}
                    onClick={() => toggleVote("right", item.id)}
                    className={`h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078] transition ${
                      item.voted ? "border-black/12 bg-[#d2d4d8] text-[#4f545a]" : ""
                    }`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeItem("right", item.id)}
                    className="h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078]"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="relative min-h-[220px] overflow-hidden rounded-[18px] border border-black/6 bg-[#eeeeef] p-6 shadow-[0_22px_44px_rgba(0,0,0,0.06)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-[''] max-[840px]:min-h-[200px]">
          <h2 className="m-0 text-lg font-medium text-[#51555b]">What went wrong</h2>
          <div className="mt-[14px]">
            <div className="relative">
              <input
                className="block h-[42px] w-full rounded-[10px] border border-black/6 bg-white/45 px-3 pr-11 text-[#565b62] placeholder:text-[#9aa0a6]"
                type="text"
                placeholder="Type and press enter"
                value={wentWrongInput}
                onChange={(event) => setWentWrongInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addWentWrong();
                  }
                }}
              />
              <button
                type="button"
                aria-label="Add"
                onClick={addWentWrong}
                className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-[10px] border border-black/6 bg-white/55 text-[#6a7078] active:translate-y-[calc(-50%+1px)]"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2.2]">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
          <ul className="mt-[14px] flex list-none flex-col gap-2.5 p-0" aria-label="What went wrong list">
            {sortItems(wentWrongItems).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-[14px] border border-black/6 bg-white/28 px-3 py-3 text-sm text-[#4f545a]"
              >
                <span className="min-w-full flex-1 whitespace-normal pr-1.5 leading-[1.35]">{item.text}</span>
                <span className="ml-auto inline-flex items-center gap-2">
                  <span className="min-w-5 text-right text-xs text-[#7a8088]">{item.votes}</span>
                  <button
                    type="button"
                    aria-label="Upvote"
                    aria-pressed={item.voted}
                    onClick={() => toggleVote("wrong", item.id)}
                    className={`h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078] transition ${
                      item.voted ? "border-black/12 bg-[#d2d4d8] text-[#4f545a]" : ""
                    }`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeItem("wrong", item.id)}
                    className="h-[30px] w-[30px] rounded-[10px] border border-black/6 bg-white/55 text-center leading-7 text-[#6a7078]"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="relative overflow-hidden rounded-2xl border border-black/6 bg-[#eeeeef] p-[18px] shadow-[0_18px_38px_rgba(0,0,0,0.05)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/50 before:to-white/0 before:content-['']">
            <div className="relative z-10">
              <h3 className="m-0 text-base font-medium text-[#565b62]">People online</h3>
              <p className="mt-2 text-sm text-[#7a8088]">8 available</p>
              <ul aria-label="People online" className="mt-[14px] flex list-none flex-col gap-2.5 p-0">
                {people.map((person) => (
                  <li
                    key={person.name}
                    className="flex items-center justify-between gap-3 rounded-[14px] border border-black/6 bg-white/28 px-3 py-3"
                  >
                    <span className="inline-flex items-center gap-2.5 text-sm text-[#4f545a]">
                      <span
                        aria-hidden
                        className={`size-[14px] rounded-full ${person.online ? "bg-[#34c759]" : "bg-[#c9ccd1]"}`}
                      />
                      {person.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
