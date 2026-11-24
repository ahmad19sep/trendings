import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb, isDatabaseConfigured } from "../../db/client";
import { sessions, users } from "../../db/schema";

import {
  ENV_USER_ID,
  isLocalAuthBypassEnabled,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from "./constants";
import {
  hashSessionToken,
  newSessionId,
  signSessionToken,
  verifySessionToken,
} from "./token";
import type { AuthUser } from "./user";

export type AuthSession = AuthUser & {
  sessionId: string;
  expiresAt: Date;
  bypassed: boolean;
};

export async function createSession(user: AuthUser): Promise<AuthSession> {
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_MAX_AGE_SECONDS * 1000);
  const sessionId = newSessionId();
  const token = await signSessionToken({
    userId: user.id,
    sessionId,
    displayName: user.displayName,
    expiresAt,
  });

  if (isDatabaseConfigured()) {
    await getDb().insert(sessions).values({
      id: sessionId,
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      lastSeenAt: new Date(now),
    });
  }

  (await cookies()).set(
    SESSION_COOKIE_NAME,
    token,
    sessionCookieOptions(now),
  );

  return { ...user, sessionId, expiresAt, bypassed: false };
}

export async function readSession(): Promise<AuthSession | null> {
  if (isLocalAuthBypassEnabled()) {
    return {
      id: ENV_USER_ID,
      displayName: process.env.ADMIN_DISPLAY_NAME?.trim() || "Local preview",
      sessionId: "local-development-bypass",
      expiresAt: new Date("2999-12-31T23:59:59.000Z"),
      bypassed: true,
    };
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims || !claims.exp) return null;

  const expiresAt = new Date(claims.exp * 1000);

  if (!isDatabaseConfigured()) {
    if (claims.sub !== ENV_USER_ID) return null;
    return {
      id: claims.sub,
      displayName: claims.name,
      sessionId: claims.sid,
      expiresAt,
      bypassed: false,
    };
  }

  const now = new Date();
  const [record] = await getDb()
    .select({
      sessionId: sessions.id,
      userId: users.id,
      displayName: users.displayName,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, claims.sid),
        eq(sessions.tokenHash, hashSessionToken(token)),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!record || record.userId !== claims.sub) return null;

  await getDb()
    .update(sessions)
    .set({ lastSeenAt: now })
    .where(eq(sessions.id, record.sessionId));

  return {
    id: record.userId,
    displayName: record.displayName,
    sessionId: record.sessionId,
    expiresAt: record.expiresAt,
    bypassed: false,
  };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token && isDatabaseConfigured()) {
    await getDb()
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)));
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

