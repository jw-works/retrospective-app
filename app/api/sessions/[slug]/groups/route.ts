import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { enforceRequestRateLimit, mapErrorToResponse, requireToken } from "@/lib/backend/http";

// Creates a new group by merging two standalone entries on the same side.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    enforceRequestRateLimit(request, { kind: "write", scope: "groups.create" });
    const { slug } = await params;
    const token = requireToken(request);
    const body = (await request.json()) as { sourceEntryId?: string; targetEntryId?: string; name?: string };

    const sourceEntryId = body.sourceEntryId?.trim();
    const targetEntryId = body.targetEntryId?.trim();
    const name = body.name?.trim();
    if (!sourceEntryId || !targetEntryId || !name) {
      return NextResponse.json({ error: "sourceEntryId, targetEntryId, and name are required" }, { status: 400 });
    }

    const group = await backendStore.createGroup({ slug, token, sourceEntryId, targetEntryId, name });
    return NextResponse.json({ group });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
