import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse } from "@/lib/backend/http";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const result = await backendStore.joinSession({ slug, name });
    return NextResponse.json({
      participant: {
        id: result.participant.id,
        name: result.participant.name,
        isAdmin: result.participant.isAdmin
      },
      token: result.token,
      sessionSlug: result.sessionSlug
    });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
