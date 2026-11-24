import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SESSION_MAX_AGE_SECONDS } from "./constants";
import { AuthConfigurationError } from "./errors";
import {
  hashSessionToken,
  signSessionToken,
  verifySessionToken,
} from "./token";

const originalSecret = process.env.SESSION_SECRET;

describe("session token", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-bytes-long";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  });

  it("signs and verifies the intended claims", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = await signSessionToken({
      userId: "00000000-0000-4000-8000-000000000001",
      sessionId: "00000000-0000-4000-8000-000000000002",
      displayName: "Ahmad",
      expiresAt,
    });

    const claims = await verifySessionToken(token);
    expect(claims).toMatchObject({
      sub: "00000000-0000-4000-8000-000000000001",
      sid: "00000000-0000-4000-8000-000000000002",
      name: "Ahmad",
    });
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSessionToken({
      userId: "user",
      sessionId: "session",
      displayName: "Ahmad",
      expiresAt: new Date(Date.now() + 60_000),
    });
    process.env.SESSION_SECRET = "another-test-session-secret-that-is-long-enough";

    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it("never signs a session beyond seven days", async () => {
    const token = await signSessionToken({
      userId: "user",
      sessionId: "session",
      displayName: "Ahmad",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    const claims = await verifySessionToken(token);

    expect(claims).not.toBeNull();
    expect((claims?.exp ?? 0) - (claims?.iat ?? 0)).toBeLessThanOrEqual(
      SESSION_MAX_AGE_SECONDS,
    );
  });

  it("requires a sufficiently long secret", async () => {
    process.env.SESSION_SECRET = "too-short";
    await expect(
      signSessionToken({
        userId: "user",
        sessionId: "session",
        displayName: "Ahmad",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toBeInstanceOf(AuthConfigurationError);
  });

  it("hashes bearer tokens without preserving them", () => {
    const first = hashSessionToken("secret-token");
    expect(first).toBe(hashSessionToken("secret-token"));
    expect(first).not.toContain("secret-token");
    expect(first).toHaveLength(64);
  });
});

