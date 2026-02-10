export type Side = "right" | "wrong";

export type RetroItem = {
  id: string;
  text: string;
};

export type ItemEntry = {
  kind: "item";
  id: string;
  text: string;
  votes: number;
  voted: boolean;
  ts: number;
};

export type GroupEntry = {
  kind: "group";
  id: string;
  name: string;
  items: RetroItem[];
  votes: number;
  voted: boolean;
  ts: number;
};

export type RetroEntry = ItemEntry | GroupEntry;

export type DiscussionTopic = {
  id: string;
  side: Side;
  kind: "item" | "group";
  votes: number;
  ts: number;
  title: string;
  items: string[];
};

export const DISCUSSION_SESSION_KEY = "retro.discussion.session.v1";

export function sortEntries(entries: RetroEntry[]) {
  return [...entries].sort((a, b) => b.votes - a.votes || b.ts - a.ts);
}

export function buildDiscussionQueue(wentRight: RetroEntry[], wentWrong: RetroEntry[]): DiscussionTopic[] {
  const toTopics = (side: Side, entries: RetroEntry[]) =>
    entries.map((entry): DiscussionTopic => {
      if (entry.kind === "item") {
        return {
          id: `${side}:${entry.id}`,
          side,
          kind: "item",
          votes: entry.votes,
          ts: entry.ts,
          title: entry.text,
          items: []
        };
      }

      return {
        id: `${side}:${entry.id}`,
        side,
        kind: "group",
        votes: entry.votes,
        ts: entry.ts,
        title: entry.name,
        items: entry.items.map((item) => item.text)
      };
    });

  return [...toTopics("right", wentRight), ...toTopics("wrong", wentWrong)].sort((a, b) => {
    if (a.side !== b.side) return a.side === "right" ? -1 : 1;
    if (a.votes !== b.votes) return b.votes - a.votes;
    return b.ts - a.ts;
  });
}
