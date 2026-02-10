import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse, requireToken } from "@/lib/backend/http";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
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
