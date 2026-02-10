import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse } from "@/lib/backend/http";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const token = _request.headers.get("x-participant-token");
    const state = await backendStore.getSessionState({ slug, token });
    return NextResponse.json(state);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
