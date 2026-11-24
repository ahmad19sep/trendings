import { Suspense } from "react";

import { BookmarksView } from "@/components/bookmarks/bookmarks-view";
import { PageShell } from "@/components/page-shell";
import { getDashboardTopics } from "@/lib/dashboard/data";

async function SavedTopics() {
  const result = await getDashboardTopics();
  return <BookmarksView topics={result.topics} />;
}

export default function BookmarksPage() {
  return (
    <PageShell
      eyebrow="Saved evidence"
      title="Bookmarks, notes, and score snapshots"
      description="Keep your own research context separate from provider data and compare the score you saved with the score now."
    >
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />}>
        <SavedTopics />
      </Suspense>
    </PageShell>
  );
}

