export const SESSION_COOKIE_NAME = "ctr_session";
export const SESSION_ISSUER = "creator-trend-radar";
export const SESSION_AUDIENCE = "creator-trend-radar";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

export const ENV_USER_ID = "00000000-0000-4000-8000-000000000001";

export function sessionCookieOptions(now = Date.now()) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: new Date(now + SESSION_MAX_AGE_SECONDS * 1000),
  };
}

export function isLocalAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.AUTH_BYPASS_LOCAL === "true"
  );
}

