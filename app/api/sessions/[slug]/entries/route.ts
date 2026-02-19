import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { enforceRequestRateLimit, mapErrorToResponse, requireToken } from "@/lib/backend/http";
import type { EntryType } from "@/lib/backend/types";

// Handles entry creation and admin "clear all entries" action.
const entryTypes: EntryType[] = ["went_right", "went_wrong"];

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    enforceRequestRateLimit(request, { kind: "write", scope: "entries.create" });
    const { slug } = await params;
    const token = requireToken(request);
    const body = (await request.json()) as { type?: EntryType; content?: string };

    if (!body.type || !entryTypes.includes(body.type)) {
      return NextResponse.json({ error: "type must be went_right or went_wrong" }, { status: 400 });
    }

    const content = body.content?.trim();
    if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

    const entry = await backendStore.createEntry({ slug, token, type: body.type, content });
    return NextResponse.json({ entry });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    enforceRequestRateLimit(request, { kind: "write", scope: "entries.clear" });
    const { slug } = await params;
    const token = requireToken(request);
    const result = await backendStore.clearEntries({ slug, token });
    return NextResponse.json(result);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
