import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse, requireToken } from "@/lib/backend/http";

// Deletes one entry (permission checks are enforced in store layer).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; entryId: string }> }
) {
  try {
    const { slug, entryId } = await params;
    const token = requireToken(request);
    const result = await backendStore.deleteEntry({ slug, token, entryId });
    return NextResponse.json(result);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}

// Updates one entry content (permission checks are enforced in store layer).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; entryId: string }> }
) {
  try {
    const { slug, entryId } = await params;
    const token = requireToken(request);
    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim() ?? "";
    if (!content) return NextResponse.json({ error: "Entry content is required" }, { status: 400 });

    const entry = await backendStore.updateEntry({ slug, token, entryId, content });
    return NextResponse.json({ entry });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
