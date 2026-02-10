import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse, requireToken } from "@/lib/backend/http";

// Removes an entry from a group; group may auto-cleanup if too small.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; entryId: string }> }
) {
  try {
    const { slug, entryId } = await params;
    const token = requireToken(request);
    const result = await backendStore.ungroupEntry({ slug, token, entryId });
    return NextResponse.json(result);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
