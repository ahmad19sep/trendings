import { PageShell } from "@/components/page-shell";
import { WatchlistView } from "@/components/watch/watchlist-view";

export default function WatchPage() {
  return (
    <PageShell
      eyebrow="Watchlists & alerts"
      title="Track what matters to you"
      description="Set explicit evidence thresholds. Alerts report a match; they never tell you what to make."
    >
      <WatchlistView />
    </PageShell>
  );
}

