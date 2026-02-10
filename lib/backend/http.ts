import { NextResponse } from "next/server";

// Route-level HTTP helpers that keep error handling consistent across endpoints.
export type ApiErrorCode = 400 | 401 | 403 | 404 | 409;

export function jsonError(message: string, status: ApiErrorCode = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function mapErrorToResponse(error: unknown) {
  if (!(error instanceof Error)) return jsonError("Unexpected error", 400);

  if (error.message === "Unauthorized") return jsonError("Unauthorized", 401);
  if (error.message === "Forbidden") return jsonError("Forbidden", 403);
  if (error.message.endsWith("not found") || error.message === "Session not found") {
    return jsonError(error.message, 404);
  }
  if (error.message === "Vote limit reached") return jsonError(error.message, 409);

  return jsonError(error.message || "Request failed", 400);
}

export function requireToken(request: Request): string {
  const token = request.headers.get("x-participant-token");
  if (!token) throw new Error("Unauthorized");
  return token;
}
