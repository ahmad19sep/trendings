import { Suspense } from "react";

import { CompareMarketsView } from "@/components/compare/compare-markets-view";
import { PageShell } from "@/components/page-shell";
import { getDashboardTopics } from "@/lib/dashboard/data";

async function Comparison() {
  const result = await getDashboardTopics();
  return <CompareMarketsView topics={result.topics} />;
}

export default function ComparePage() {
  return (
    <PageShell
      eyebrow="Market gap"
      title="Compare attention across markets"
      description="See what is present in one monitored market and absent in another without confusing publisher country, story location, or audience inference."
    >
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />}
      >
        <Comparison />
      </Suspense>
    </PageShell>
  );
}

