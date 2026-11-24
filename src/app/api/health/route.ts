import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db/client";
import { requireRouteSession } from "@/lib/auth";

export async function GET(): Promise<Response> {
  const auth = await requireRouteSession();
  if (!auth.ok) return auth.response;

  if (!isDatabaseConfigured()) {
    return Response.json(
      {
        status: "degraded",
        database: "not_configured",
        worker: "unknown",
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await getDb().execute(sql`select 1 as ok`);
    return Response.json(
      {
        status: "ok",
        database: "reachable",
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "error",
        database: "unreachable",
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

