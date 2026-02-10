import { NextResponse } from "next/server";
import { backendStore } from "@/lib/backend/store";
import { mapErrorToResponse, requireToken } from "@/lib/backend/http";
import type { EntryType } from "@/lib/backend/types";

// Moves an entry between "went right" and "went wrong" columns.
const entryTypes: EntryType[] = ["went_right", "went_wrong"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; entryId: string }> }
) {
  try {
    const { slug, entryId } = await params;
    const token = requireToken(request);
    const body = (await request.json()) as { type?: EntryType };

    if (!body.type || !entryTypes.includes(body.type)) {
      return NextResponse.json({ error: "type must be went_right or went_wrong" }, { status: 400 });
    }

    const result = await backendStore.moveEntry({ slug, token, entryId, type: body.type });
    return NextResponse.json(result);
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
