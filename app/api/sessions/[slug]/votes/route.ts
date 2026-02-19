import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { enforceRequestRateLimit, mapErrorToResponse, requireToken } from "@/lib/backend/http";

// Adds a single vote for an entry (store enforces 5-vote cap per participant).
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    enforceRequestRateLimit(request, { kind: "write", scope: "votes.add" });
    const { slug } = await params;
    const token = requireToken(request);
    const body = (await request.json()) as { entryId?: string };
    const entryId = body.entryId?.trim();
    if (!entryId) return NextResponse.json({ error: "entryId is required" }, { status: 400 });

    const result = await backendStore.addVote({ slug, token, entryId });
    return NextResponse.json(result);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
