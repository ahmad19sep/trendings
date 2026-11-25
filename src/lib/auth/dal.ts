import { redirect } from "next/navigation";
import { cache } from "react";

import { readSession, type AuthSession } from "./session";

export async function getOptionalSession(): Promise<AuthSession | null> {
  return readSession();
}

export const requireSession = cache(async (): Promise<AuthSession> => {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
});

export async function requireRouteSession(): Promise<
  | { ok: true; session: AuthSession }
  | { ok: false; response: Response }
> {
  const session = await readSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, session };
}

