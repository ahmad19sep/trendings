import { RefreshCw } from "lucide-react";
import { Suspense } from "react";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PageShell } from "@/components/page-shell";
import { getDashboardTopics } from "@/lib/dashboard/data";

async function DashboardFeed() {
  const result = await getDashboardTopics();
  return <DashboardView result={result} />;
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]" aria-label="Loading trends">
      <div className="hidden h-96 animate-pulse rounded-2xl bg-[var(--surface-muted)] lg:block" />
      <div className="space-y-3">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="h-44 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)]"
          />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PageShell
      eyebrow="Signal desk"
      title="What is gaining attention now?"
      description="Real source signals, transparent scoring, and evidence for Pakistan-first content research. You choose what to make."
      actions={
        <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink-muted)]">
          <RefreshCw aria-hidden="true" size={15} />
          Auto refresh · 30 min
        </span>
      }
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardFeed />
      </Suspense>
    </PageShell>
  );
}

