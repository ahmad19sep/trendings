import { createHash, randomUUID } from "node:crypto";

import { jwtVerify, SignJWT, type JWTPayload } from "jose";

import {
  SESSION_AUDIENCE,
  SESSION_ISSUER,
  SESSION_MAX_AGE_SECONDS,
} from "./constants";
import { AuthConfigurationError } from "./errors";

export type SessionClaims = JWTPayload & {
  sub: string;
  sid: string;
  name: string;
};

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new AuthConfigurationError(
      "SESSION_SECRET must contain at least 32 bytes.",
    );
  }

  return new TextEncoder().encode(secret);
}

export function newSessionId(): string {
  return randomUUID();
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function signSessionToken(input: {
  userId: string;
  sessionId: string;
  displayName: string;
  expiresAt: Date;
}): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const maximumExpiry = nowSeconds + SESSION_MAX_AGE_SECONDS;
  const requestedExpiry = Math.floor(input.expiresAt.getTime() / 1000);

  return new SignJWT({
    sid: input.sessionId,
    name: input.displayName,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(input.userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt(nowSeconds)
    .setExpirationTime(Math.min(requestedExpiry, maximumExpiry))
    .sign(sessionKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });

    if (
      !payload.sub ||
      typeof payload.sid !== "string" ||
      typeof payload.name !== "string" ||
      !payload.exp ||
      !payload.iat ||
      payload.exp - payload.iat > SESSION_MAX_AGE_SECONDS
    ) {
      return null;
    }

    return payload as SessionClaims;
  } catch {
    return null;
  }
}

