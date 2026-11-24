"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  clearLoginFailures,
  assertLoginAllowed,
  loginAttemptKey,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import {
  AuthConfigurationError,
  InvalidCredentialsError,
  LoginRateLimitedError,
} from "@/lib/auth/errors";
import { safeReturnPath } from "@/lib/auth/redirect";
import { createSession, destroySession } from "@/lib/auth/session";
import { authenticatePassword } from "@/lib/auth/user";
import type { LoginState } from "@/lib/auth/login-state";

const loginSchema = z.object({
  password: z.string().min(1).max(512),
  next: z.string().max(2_048).optional(),
});

function requestAddress(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headersList.get("x-real-ip") || "unknown";
}

function hasTrustedOrigin(headersList: Headers): boolean {
  const origin = headersList.get("origin");
  if (!origin) return true;

  const host =
    headersList.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headersList.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Unable to sign in with those credentials.",
    };
  }

  const headersList = await headers();
  if (!hasTrustedOrigin(headersList)) {
    return { status: "error", message: "Unable to complete sign-in." };
  }

  const attemptKey = loginAttemptKey(requestAddress(headersList));
  const destination = safeReturnPath(parsed.data.next ?? null);

  try {
    await assertLoginAllowed(attemptKey);
    const user = await authenticatePassword(parsed.data.password);
    await createSession(user);
    await clearLoginFailures(attemptKey);
  } catch (error) {
    if (error instanceof LoginRateLimitedError) {
      return {
        status: "rate-limited",
        message: "Too many sign-in attempts. Try again in a few minutes.",
      };
    }

    if (error instanceof InvalidCredentialsError) {
      await recordLoginFailure(attemptKey);
      return {
        status: "error",
        message: "Unable to sign in with those credentials.",
      };
    }

    if (error instanceof AuthConfigurationError) {
      return {
        status: "configuration",
        message: "Sign-in is not configured yet. Check the setup notes below.",
      };
    }

    return {
      status: "error",
      message: "Sign-in is temporarily unavailable. Please try again.",
    };
  }

  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

