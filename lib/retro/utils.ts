import type { RetroEntry } from "@/lib/discussion";
import type { SessionStateResponse } from "@/lib/backend/types";

type SessionEntry = SessionStateResponse["entries"][number];

export function parseSessionCode(input: string): string {
  const value = input.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const sessionIndex = parts.findIndex((part) => part === "session");
    if (sessionIndex >= 0 && parts[sessionIndex + 1]) {
      return parts[sessionIndex + 1].toLowerCase();
    }
  } catch {
    // Not a URL; continue with raw value.
  }

  return value.toLowerCase();
}

export function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "--";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

export function colorFromSeed(seed: string): { background: string; border: string; text: string } {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const hue = hash % 360;
  return {
    background: `hsl(${hue} 70% 92%)`,
    border: `hsl(${hue} 55% 78%)`,
    text: `hsl(${hue} 42% 28%)`
  };
}

export function toRetroItems(
  entries: SessionEntry[],
  groups: SessionStateResponse["groups"],
  type: SessionEntry["type"]
): RetroEntry[] {
  const byType = entries.filter((entry) => entry.type === type);
  const groupedIds = new Set<string>();

  const groupEntries: RetroEntry[] = groups
    .filter((group) => group.type === type)
    .map((group) => {
      const items = byType.filter((entry) => entry.groupId === group.id);
      items.forEach((entry) => groupedIds.add(entry.id));
      return {
        kind: "group" as const,
        id: group.id,
        name: group.name,
        items: items.map((entry) => ({ id: entry.id, text: entry.content })),
        votes: items.reduce((sum, entry) => sum + entry.votes, 0),
        voted: items.some((entry) => entry.votedByViewer),
        ts: Date.parse(group.createdAt)
      };
    })
    .filter((group) => group.items.length >= 2);

  const standalone: RetroEntry[] = byType
    .filter((entry) => !groupedIds.has(entry.id))
    .map((entry) => ({
      kind: "item" as const,
      id: entry.id,
      text: entry.content,
      votes: entry.votes,
      voted: entry.votedByViewer,
      ts: Date.parse(entry.createdAt)
    }));

  return [...standalone, ...groupEntries];
}
