import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { enforceRequestRateLimit, mapErrorToResponse } from "@/lib/backend/http";

// Session bootstrap endpoint: creates session + admin participant + auth token.
export async function POST(request: Request) {
  try {
    enforceRequestRateLimit(request, { kind: "write", scope: "sessions.create" });
    const body = (await request.json()) as { title?: string; adminName?: string; sprintLabel?: string; voteLimit?: number };
    const title = body.title?.trim();
    const adminName = body.adminName?.trim();
    const sprintLabel = body.sprintLabel?.trim() ?? "";
    const voteLimit = body.voteLimit ?? 5;

    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    if (!adminName) return NextResponse.json({ error: "adminName is required" }, { status: 400 });
    if (!Number.isInteger(voteLimit) || voteLimit < 1 || voteLimit > 20) {
      return NextResponse.json({ error: "voteLimit must be an integer between 1 and 20" }, { status: 400 });
    }

    const result = await backendStore.createSession({ title, adminName, sprintLabel, voteLimit });

    return NextResponse.json({
      session: {
        id: result.session.id,
        slug: result.session.slug,
        title: result.session.title,
        sprintLabel: result.session.sprintLabel ?? null,
        voteLimit: result.session.voteLimit,
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
