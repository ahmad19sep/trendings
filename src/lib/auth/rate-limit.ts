import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "../../db/client";
import { loginAttempts } from "../../db/schema";

import {
  LOGIN_LOCK_MS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
} from "./constants";
import { LoginRateLimitedError } from "./errors";

type MemoryAttempt = {
  failures: number;
  firstFailureAt: Date;
  lockedUntil: Date | null;
};

const memoryAttempts = new Map<string, MemoryAttempt>();

function pruneMemoryAttempts(now: Date): void {
  if (memoryAttempts.size < 1_024) return;
  for (const [key, value] of memoryAttempts) {
    const newestRelevantTime =
      value.lockedUntil?.getTime() ?? value.firstFailureAt.getTime();
    if (now.getTime() - newestRelevantTime > LOGIN_WINDOW_MS + LOGIN_LOCK_MS) {
      memoryAttempts.delete(key);
    }
  }
}

export function loginAttemptKey(clientAddress: string): string {
  return createHash("sha256")
    .update(`single-user:${clientAddress}`)
    .digest("hex");
}

export async function assertLoginAllowed(
  key: string,
  now = new Date(),
): Promise<void> {
  if (!isDatabaseConfigured()) {
    const record = memoryAttempts.get(key);
    if (record?.lockedUntil && record.lockedUntil > now) {
      throw new LoginRateLimitedError(record.lockedUntil);
    }
    return;
  }

  const [record] = await getDb()
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .limit(1);

  if (record?.lockedUntil && record.lockedUntil > now) {
    throw new LoginRateLimitedError(record.lockedUntil);
  }
}

export async function recordLoginFailure(
  key: string,
  now = new Date(),
): Promise<void> {
  if (!isDatabaseConfigured()) {
    pruneMemoryAttempts(now);
    const record = memoryAttempts.get(key);
    const windowExpired =
      !record || now.getTime() - record.firstFailureAt.getTime() > LOGIN_WINDOW_MS;
    const failures = windowExpired ? 1 : record.failures + 1;
    memoryAttempts.set(key, {
      failures,
      firstFailureAt: windowExpired ? now : record.firstFailureAt,
      lockedUntil:
        failures >= LOGIN_MAX_FAILURES
          ? new Date(now.getTime() + LOGIN_LOCK_MS)
          : null,
    });
    return;
  }

  const db = getDb();
  const [record] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .limit(1);

  const windowStarted = record?.firstFailureAt?.getTime() ?? 0;
  const windowExpired = now.getTime() - windowStarted > LOGIN_WINDOW_MS;
  const failures = windowExpired ? 1 : (record?.failures ?? 0) + 1;
  const firstFailureAt = windowExpired
    ? now
    : (record?.firstFailureAt ?? now);
  const lockedUntil =
    failures >= LOGIN_MAX_FAILURES
      ? new Date(now.getTime() + LOGIN_LOCK_MS)
      : null;

  await db
    .insert(loginAttempts)
    .values({
      key,
      failures,
      firstFailureAt,
      lockedUntil,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: { failures, firstFailureAt, lockedUntil, updatedAt: now },
    });
}

export async function clearLoginFailures(key: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    memoryAttempts.delete(key);
    return;
  }
  await getDb().delete(loginAttempts).where(eq(loginAttempts.key, key));
}

