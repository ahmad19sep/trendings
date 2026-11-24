import { CalendarDays, FileText, HeartPulse } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { digests } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00+05:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export default async function DigestPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  await requireSession();
  const { date } = await params;
  if (!isDate(date)) notFound();

  let digest: typeof digests.$inferSelect | null = null;
  if (isDatabaseConfigured()) {
    [digest] = await getDb()
      .select()
      .from(digests)
      .where(eq(digests.digestDate, date))
      .limit(1);
  }

  const displayDate = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+05:00`));

  return (
    <PageShell
      eyebrow="Daily digest archive"
      title={displayDate}
      description="A fixed morning snapshot: top topics, global gaps, rising signals, upcoming pre-buzz, watch hits, health, and AI spend."
      actions={
        <div className="flex gap-2">
          <Link href={`/digest/${shiftDate(date, -1)}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
            Previous day
          </Link>
          <Link href={`/digest/${shiftDate(date, 1)}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
            Next day
          </Link>
        </div>
      }
    >
      {digest ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2">
              <FileText aria-hidden="true" size={18} className="text-[var(--accent)]" />
              <h2 className="text-lg font-semibold text-[var(--ink)]">Stored digest</h2>
              <Badge tone="accent">Generated</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              This digest is stored as a versioned payload. Structured section rendering will use the worker’s final digest schema; the payload is preserved without inventing missing sections.
            </p>
            <pre className="scrollbar-thin mt-4 max-h-[32rem] overflow-auto rounded-xl bg-[var(--surface-muted)] p-4 text-xs text-[var(--ink-muted)]">
              {JSON.stringify(digest.payload, null, 2)}
            </pre>
          </section>
          <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--ink)]">Generation facts</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[var(--ink-faint)]">Timezone</dt>
                <dd className="font-semibold text-[var(--ink)]">{digest.timezone}</dd>
              </div>
              <div>
                <dt className="text-[var(--ink-faint)]">Generated</dt>
                <dd className="font-semibold text-[var(--ink)]">{digest.generatedAt.toISOString()}</dd>
              </div>
            </dl>
          </aside>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 text-center">
            <CalendarDays aria-hidden="true" size={28} className="text-[var(--accent)]" />
            <h2 className="mt-3 text-lg font-semibold text-[var(--ink)]">No digest was generated for this date</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--ink-muted)]">
              Digests are never backfilled with fixture data. Start PostgreSQL and the worker, then the configured 08:00 Asia/Karachi run will create the first real archive entry.
            </p>
          </div>
          <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2">
              <HeartPulse aria-hidden="true" size={18} className="text-[var(--amber)]" />
              <h2 className="text-sm font-semibold text-[var(--ink)]">Expected sections</h2>
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--ink-muted)]">
              <li>Top 10 topics with score reasons</li>
              <li>Worldwide gaps missing in Pakistan</li>
              <li>Top rising signals</li>
              <li>Next 7 days with pre-buzz</li>
              <li>Watchlist hits and source health</li>
              <li>Previous day’s AI spend</li>
            </ul>
          </aside>
        </div>
      )}
    </PageShell>
  );
}

