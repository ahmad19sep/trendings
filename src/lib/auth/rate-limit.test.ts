import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { LOGIN_MAX_FAILURES } from "./constants";
import { LoginRateLimitedError } from "./errors";
import {
  assertLoginAllowed,
  clearLoginFailures,
  loginAttemptKey,
  recordLoginFailure,
} from "./rate-limit";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("login limiter", () => {
  it("hashes client identifiers before persistence", () => {
    const key = loginAttemptKey("203.0.113.20");
    expect(key).toHaveLength(64);
    expect(key).not.toContain("203.0.113.20");
  });

  it("locks repeated attempts even without a database", async () => {
    delete process.env.DATABASE_URL;
    const key = randomUUID();
    const now = new Date("2026-11-23T12:00:00.000Z");

    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES; attempt += 1) {
      await recordLoginFailure(key, now);
    }

    await expect(assertLoginAllowed(key, now)).rejects.toBeInstanceOf(
      LoginRateLimitedError,
    );
    await clearLoginFailures(key);
    await expect(assertLoginAllowed(key, now)).resolves.toBeUndefined();
  });
});

