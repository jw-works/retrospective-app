import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

type TokenPayload = {
  participantId: string;
  sessionId: string;
  iat: number;
  exp: number;
  jti: string;
};

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_SECONDS = 60 * 60 * 12;
const FALLBACK_SECRET = "dev-insecure-secret-change-me";

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getTokenSecret() {
  return process.env.AUTH_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || FALLBACK_SECRET;
}

function getTokenTtlSeconds() {
  const parsed = Number(process.env.AUTH_TOKEN_TTL_SECONDS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_SECONDS;
  return Math.floor(parsed);
}

function sign(input: string) {
  return createHmac("sha256", getTokenSecret()).update(input).digest("base64url");
}

export function issueParticipantToken(input: { participantId: string; sessionId: string }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    participantId: input.participantId,
    sessionId: input.sessionId,
    iat: now,
    exp: now + getTokenTtlSeconds(),
    jti: randomUUID()
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${TOKEN_VERSION}.${payloadEncoded}`);
  return `${TOKEN_VERSION}.${payloadEncoded}.${signature}`;
}

export function verifyParticipantToken(token: string): TokenPayload {
  const [version, payloadEncoded, signature] = token.split(".");
  if (!version || !payloadEncoded || !signature) throw new Error("Unauthorized");
  if (version !== TOKEN_VERSION) throw new Error("Unauthorized");

  const expected = sign(`${version}.${payloadEncoded}`);
  const left = Buffer.from(signature, "base64url");
  const right = Buffer.from(expected, "base64url");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error("Unauthorized");
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded)) as TokenPayload;
  } catch {
    throw new Error("Unauthorized");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw new Error("Token expired");
  if (!payload.participantId || !payload.sessionId) throw new Error("Unauthorized");

  return payload;
}
