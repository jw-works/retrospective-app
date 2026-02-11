import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse, requireToken } from "@/lib/backend/http";

// Admin-only endpoint to remove sprint action items.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; actionId: string }> }
) {
  try {
    const { slug, actionId } = await params;
    const token = requireToken(request);
    const result = await backendStore.deleteActionItem({ slug, token, actionItemId: actionId });
    return NextResponse.json(result);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
