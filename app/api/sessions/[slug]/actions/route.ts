import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { enforceRequestRateLimit, mapErrorToResponse, requireToken } from "@/lib/backend/http";

// Admin-only endpoint to add sprint action items.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    enforceRequestRateLimit(request, { kind: "write", scope: "actions.create" });
    const { slug } = await params;
    const token = requireToken(request);
    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim() ?? "";
    if (!content) {
      return NextResponse.json({ error: "Action item content is required" }, { status: 400 });
    }

    const actionItem = await backendStore.createActionItem({ slug, token, content });
    return NextResponse.json({ actionItem });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
