import {
  generateUpcomingCalendar,
  loadCuratedEventSeeds,
  materializeCuratedEvents,
} from "../../lib/upcoming";
import { requireRouteSession } from "../../lib/auth";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function createUpcomingIcsResponse(now = new Date()): Promise<Response> {
  const seeds = await loadCuratedEventSeeds();
  const events = materializeCuratedEvents(seeds, {
    from: now,
    to: new Date(now.getTime() + ONE_YEAR_MS),
  });
  const calendar = generateUpcomingCalendar(events, { generatedAt: now });

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="creator-trend-radar-upcoming.ics"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Trend-Radar-Data-Source": "curated-pakistan-events",
    },
  });
}

export async function GET(): Promise<Response> {
  const auth = await requireRouteSession();
  if (!auth.ok) return auth.response;
  return createUpcomingIcsResponse();
}

