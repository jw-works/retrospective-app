import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse } from "@/lib/backend/http";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { title?: string; adminName?: string };
    const title = body.title?.trim();
    const adminName = body.adminName?.trim();

    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    if (!adminName) return NextResponse.json({ error: "adminName is required" }, { status: 400 });

    const result = await backendStore.createSession({ title, adminName });

    return NextResponse.json({
      session: {
        id: result.session.id,
        slug: result.session.slug,
        title: result.session.title,
        phase: result.session.phase,
        joinUrl: result.joinUrl
      },
      participant: {
        id: result.participant.id,
        name: result.participant.name,
        isAdmin: result.participant.isAdmin
      },
      token: result.token
    });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
