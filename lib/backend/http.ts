import { NextResponse } from "next/server";
import { captureError, logWarn } from "@/lib/backend/observability";
import { clientIpFromRequest, enforceRateLimit, RateLimitError } from "@/lib/backend/rate-limit";

// Route-level HTTP helpers that keep error handling consistent across endpoints.
export type ApiErrorCode = 400 | 401 | 403 | 404 | 409 | 429;

export function jsonError(message: string, status: ApiErrorCode = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function mapErrorToResponse(error: unknown, context: Record<string, unknown> = {}) {
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds: error.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
    );
  }

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

const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== "false";
const DEFAULT_WRITE_LIMIT = Number(process.env.RATE_LIMIT_WRITE_LIMIT ?? "120");
const DEFAULT_WRITE_WINDOW_MS = Number(process.env.RATE_LIMIT_WRITE_WINDOW_MS ?? "60000");
const DEFAULT_READ_LIMIT = Number(process.env.RATE_LIMIT_READ_LIMIT ?? "300");
const DEFAULT_READ_WINDOW_MS = Number(process.env.RATE_LIMIT_READ_WINDOW_MS ?? "60000");

function finitePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function enforceRequestRateLimit(
  request: Request,
  input: {
    kind: "read" | "write";
    scope: string;
  }
) {
  if (!RATE_LIMIT_ENABLED) return;

  const ip = clientIpFromRequest(request);
  const isWrite = input.kind === "write";
  const limit = isWrite
    ? finitePositive(DEFAULT_WRITE_LIMIT, 120)
    : finitePositive(DEFAULT_READ_LIMIT, 300);
  const windowMs = isWrite
    ? finitePositive(DEFAULT_WRITE_WINDOW_MS, 60_000)
    : finitePositive(DEFAULT_READ_WINDOW_MS, 60_000);

  enforceRateLimit({
    key: `${input.kind}:${input.scope}:${ip}`,
    limit,
    windowMs,
    context: { scope: input.scope, ip, kind: input.kind }
  });
}
