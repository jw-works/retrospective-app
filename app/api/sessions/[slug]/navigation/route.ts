import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse, requireToken } from "@/lib/backend/http";
import type { Section } from "@/lib/backend/types";

// Admin-only endpoint controlling the shared stage for all participants.
const sections: Section[] = ["retro", "discussion", "happiness", "done"];

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const token = requireToken(request);
    const body = (await request.json()) as { activeSection?: Section; discussionEntryId?: string | null };

    if (!body.activeSection || !sections.includes(body.activeSection)) {
      return NextResponse.json({ error: "activeSection is invalid" }, { status: 400 });
    }

    const result = await backendStore.setNavigation({
      slug,
      token,
      activeSection: body.activeSection,
      discussionEntryId: body.discussionEntryId ?? null
    });

    return NextResponse.json({ navigation: result });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
