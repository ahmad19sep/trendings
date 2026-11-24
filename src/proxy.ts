import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isLocalAuthBypassEnabled,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/token";

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export async function proxy(request: NextRequest) {
  if (isLocalAuthBypassEnabled()) {
    return withSecurityHeaders(NextResponse.next());
  }

  const isLogin = request.nextUrl.pathname === "/login";
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (isLogin) {
    if (session) {
      return withSecurityHeaders(
        NextResponse.redirect(new URL("/", request.url)),
      );
    }

    const response = NextResponse.next();
    if (token) response.cookies.delete(SESSION_COOKIE_NAME);
    return withSecurityHeaders(response);
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const response = NextResponse.redirect(loginUrl);
    if (token) response.cookies.delete(SESSION_COOKIE_NAME);
    return withSecurityHeaders(response);
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

