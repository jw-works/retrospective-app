import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { enforceRequestRateLimit, mapErrorToResponse, requireToken } from "@/lib/backend/http";

// Removes the viewer's vote for one entry.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; entryId: string }> }
) {
  try {
    enforceRequestRateLimit(request, { kind: "write", scope: "votes.remove" });
    const { slug, entryId } = await params;
    const token = requireToken(request);
    const result = await backendStore.removeVote({ slug, token, entryId });
    return NextResponse.json(result);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
