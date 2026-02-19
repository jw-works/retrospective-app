import { logWarn } from "@/lib/backend/observability";

type Bucket = {
  count: number;
  resetAt: number;
};

const CLEANUP_INTERVAL = 250;
const MAX_BUCKETS = 20000;

class RateLimitStore {
  buckets = new Map<string, Bucket>();
  operations = 0;

  cleanup(now: number) {
    this.operations += 1;
    if (this.operations % CLEANUP_INTERVAL !== 0 && this.buckets.size < MAX_BUCKETS) return;

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }

    // If traffic is high and buckets are still large, evict oldest-expiring entries.
    if (this.buckets.size > MAX_BUCKETS) {
      const sorted = [...this.buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
      const toDelete = this.buckets.size - MAX_BUCKETS;
      for (let i = 0; i < toDelete; i += 1) {
        const candidate = sorted[i];
        if (!candidate) break;
        this.buckets.delete(candidate[0]);
      }
    }
  }
}

declare global {
  var __retro_rate_limit_store__: RateLimitStore | undefined;
}

function getStore() {
  if (!globalThis.__retro_rate_limit_store__) {
    globalThis.__retro_rate_limit_store__ = new RateLimitStore();
  }
  return globalThis.__retro_rate_limit_store__;
}

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many requests");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function clientIpFromRequest(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function enforceRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  context?: Record<string, unknown>;
}) {
  const now = Date.now();
  const store = getStore();
  store.cleanup(now);

  const bucket = store.buckets.get(input.key);
  if (!bucket || bucket.resetAt <= now) {
    store.buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return;
  }

  if (bucket.count >= input.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    logWarn("rate_limit.exceeded", {
      key: input.key,
      limit: input.limit,
      windowMs: input.windowMs,
      retryAfterSeconds,
      ...(input.context ?? {})
    });
    throw new RateLimitError(retryAfterSeconds);
  }

  bucket.count += 1;
  store.buckets.set(input.key, bucket);
}
