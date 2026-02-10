import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse, requireToken } from "@/lib/backend/http";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const token = requireToken(request);
    const body = (await request.json()) as { score?: number };
    const score = body.score;

    if (typeof score !== "number" || Number.isNaN(score)) {
      return NextResponse.json({ error: "score must be a number" }, { status: 400 });
    }

    if (score < 1 || score > 10) {
      return NextResponse.json({ error: "score must be between 1 and 10" }, { status: 400 });
    }

    const result = await backendStore.upsertHappiness({ slug, token, score });
    return NextResponse.json(result);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
