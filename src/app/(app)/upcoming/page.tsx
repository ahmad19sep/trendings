import { io } from "next/cache";
import { Suspense } from "react";

import { PageShell } from "@/components/page-shell";
import { UpcomingView, type UpcomingViewEvent } from "@/components/upcoming/upcoming-view";
import { requireSession } from "@/lib/auth";
import { loadCuratedEventSeeds, materializeCuratedEvents } from "@/lib/upcoming";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

async function UpcomingEvents() {
  await requireSession();
  await io();
  const now = new Date();
  const seeds = await loadCuratedEventSeeds();
  const events = materializeCuratedEvents(seeds, {
    from: now,
    to: new Date(now.getTime() + THIRTY_DAYS),
  });
  const viewEvents: UpcomingViewEvent[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    category: event.category,
    markets: event.markets,
    startsAt: event.startsAt.toISOString(),
    localDate: event.localDate ?? null,
    timezone: event.timezone,
    confidence: event.confidence,
    confidenceLabel: event.confidenceLabel,
    sourceUrls: event.sourceUrls,
    caveat: event.caveat ?? null,
  }));

  return <UpcomingView events={viewEvents} referenceTime={now.toISOString()} />;
}

function UpcomingSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading upcoming events">
      <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="h-40 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]"
        />
      ))}
    </div>
  );
}

export default function UpcomingPage() {
  return (
    <PageShell
      eyebrow="Next 30 days"
      title="Upcoming attention windows"
      description="Scheduled events with explicit provenance, confidence, Pakistan time, and pre-buzz built only from stored observations."
    >
      <Suspense fallback={<UpcomingSkeleton />}>
        <UpcomingEvents />
      </Suspense>
    </PageShell>
  );
}

