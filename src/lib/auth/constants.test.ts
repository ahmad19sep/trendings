import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isLocalAuthBypassEnabled,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from "./constants";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session configuration", () => {
  it("uses secure, HttpOnly, SameSite=Lax production cookies", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions(0)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  });

  it("never enables the local bypass in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_BYPASS_LOCAL", "true");
    expect(isLocalAuthBypassEnabled()).toBe(false);
  });

  it("allows an explicit development-only bypass", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_BYPASS_LOCAL", "true");
    expect(isLocalAuthBypassEnabled()).toBe(true);
  });
});

