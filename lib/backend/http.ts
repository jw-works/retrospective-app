import { NextResponse } from "next/server";
import { captureError, logWarn } from "@/lib/backend/observability";

// Route-level HTTP helpers that keep error handling consistent across endpoints.
export type ApiErrorCode = 400 | 401 | 403 | 404 | 409;

export function jsonError(message: string, status: ApiErrorCode = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function mapErrorToResponse(error: unknown, context: Record<string, unknown> = {}) {
  if (!(error instanceof Error)) {
    void captureError(error, context);
    return jsonError("Unexpected error", 400);
  }

  void captureError(error, context);
  if (error.message === "Unauthorized") return jsonError("Unauthorized", 401);
  if (error.message === "Token expired") return jsonError("Token expired", 401);
  if (error.message === "Forbidden") return jsonError("Forbidden", 403);
  if (error.message.endsWith("not found") || error.message === "Session not found") {
    return jsonError(error.message, 404);
  }
  if (error.message === "Vote limit reached") return jsonError(error.message, 409);
  if (error.message === "Database schema missing. Run npm run db:migrate") {
    return jsonError(error.message, 400);
  }

  return jsonError(error.message || "Request failed", 400);
}

export function requireToken(request: Request): string {
  const token = request.headers.get("x-participant-token");
  if (!token) {
    logWarn("auth.token_missing", { path: new URL(request.url).pathname });
    throw new Error("Unauthorized");
  }
  return token;
}
