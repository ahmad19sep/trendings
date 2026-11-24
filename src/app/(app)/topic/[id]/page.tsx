import {
  Activity,
  BookOpenCheck,
  ExternalLink,
  Flag,
  Gauge,
  RadioTower,
} from "lucide-react";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { TopicNotes } from "@/components/topic/topic-notes";
import { Badge } from "@/components/ui/badge";
import { getDashboardTopic } from "@/lib/dashboard/data";
import type { ComponentKey } from "@/lib/scoring";

const componentLabels: Record<ComponentKey, string> = {
  momentum: "Early momentum",
  reach: "Cross-source reach",
  nativeRank: "Source-native rank",
  freshness: "Freshness",
  gap: "Pakistan-vs-world gap",
  explainability: "Explainability",
  shelfLife: "Shelf life",
  audienceRelevance: "Audience relevance",
};

function formatRawInputs(inputs: Record<string, unknown>) {
  return Object.entries(inputs)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("/") : String(value)}`)
    .join(" · ");
}

export default async function TopicEvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const topic = await getDashboardTopic(id);
  if (!topic) notFound();

  const query = encodeURIComponent(topic.titleOriginal);
  const tag = topic.titleOriginal.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 80);
  const deepLinks = [
    ["Google Trends", `https://trends.google.com/trends/explore?q=${query}`],
    ["YouTube", `https://www.youtube.com/results?search_query=${query}`],
    ["X Explore", "https://x.com/explore/tabs/trending"],
    ["TikTok", `https://www.tiktok.com/search?q=${query}`],
    ["Instagram", `https://www.instagram.com/explore/tags/${tag}/`],
    ["Reddit", `https://www.reddit.com/search/?q=${query}`],
  ] as const;

  return (
    <PageShell
      eyebrow="Topic evidence"
      title={topic.titleOriginal}
      description="The score explains contentability, not truth or popularity. Raw provider signals stay separate and every missing input remains visible."
      actions={
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">{topic.category}</Badge>
          {topic.collectingHistory ? <Badge tone="warning">Collecting history</Badge> : null}
          {topic.markets.map((market) => <Badge key={market}>{market}</Badge>)}
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2">
              <BookOpenCheck aria-hidden="true" size={18} className="text-[var(--accent)]" />
              <h2 className="text-lg font-semibold text-[var(--ink)]">Summary</h2>
              <Badge>AI off</Badge>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-muted)] p-4">
              <p className="font-semibold text-[var(--ink)]">Summary unavailable</p>
              <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                AI mode is off. Raw headlines are shown below instead; no uncited explanation is generated.
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Gauge aria-hidden="true" size={18} className="text-[var(--accent)]" />
                <h2 className="text-lg font-semibold text-[var(--ink)]">Score breakdown</h2>
              </div>
              <div className="text-right">
                <span className="block text-2xl font-bold tabular-nums text-[var(--accent)]">{topic.score}</span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">of 100</span>
              </div>
            </div>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-[0.08em] text-[var(--ink-faint)]">
                  <tr><th className="px-5 py-3">Component</th><th className="px-4 py-3">Raw inputs</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Weight</th><th className="px-4 py-3">Contribution</th><th className="px-4 py-3">Method</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {topic.scoreBreakdown.map((row) => (
                    <tr key={row.key}>
                      <td className="px-5 py-4 align-top"><p className="font-semibold text-[var(--ink)]">{componentLabels[row.key]}</p><p className="mt-1 max-w-xs text-xs leading-5 text-[var(--ink-muted)]">{row.howComputed}</p></td>
                      <td className="max-w-sm px-4 py-4 align-top text-xs leading-5 text-[var(--ink-muted)]">{formatRawInputs(row.rawInputs)}</td>
                      <td className="px-4 py-4 align-top font-semibold tabular-nums text-[var(--ink)]">{row.value === null ? "Missing" : row.value.toFixed(1)}</td>
                      <td className="px-4 py-4 align-top tabular-nums text-[var(--ink-muted)]">{row.baseWeight}% → {row.effectiveWeight.toFixed(1)}%</td>
                      <td className="px-4 py-4 align-top font-semibold tabular-nums text-[var(--ink)]">{row.contribution === null ? "—" : row.contribution.toFixed(2)}</td>
                      <td className="px-4 py-4 align-top"><Badge tone={row.method === "rule-based" ? "info" : "neutral"}>{row.method}</Badge>{row.reason ? <p className="mt-2 text-xs text-[var(--ink-muted)]">{row.reason}</p> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2">
              <Activity aria-hidden="true" size={18} className="text-[var(--accent)]" />
              <h2 className="text-lg font-semibold text-[var(--ink)]">Timeline</h2>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-[var(--line-strong)] px-4 py-8 text-center text-sm text-[var(--ink-muted)]">
              Collecting real hourly observations. No chart is drawn until stored history exists and its units can be stated.
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><RadioTower aria-hidden="true" size={18} className="text-[var(--accent)]" /><h2 className="text-lg font-semibold text-[var(--ink)]">Evidence</h2></div>
              <Badge>{topic.evidence.length} headlines</Badge>
            </div>
            {topic.evidence.length ? (
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {topic.evidence.map((evidence, index) => (
                  <li key={`${evidence.url}-${index}`} className="py-3">
                    <a href={evidence.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-4">
                      <div><p className="text-sm font-semibold leading-6 text-[var(--ink)] group-hover:text-[var(--accent)]">{evidence.title}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">{evidence.source ?? "Outlet unknown"} · connector: Google Trends RSS related news</p></div>
                      <ExternalLink aria-hidden="true" size={16} className="mt-1 shrink-0 text-[var(--ink-faint)]" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[var(--ink-muted)]">No related headline was supplied by this observation.</p>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--ink)]">Raw signals</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">Provider-native facts are displayed here and never silently mixed into the Contentability Score.</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl bg-[var(--surface-muted)] p-3"><dt className="text-xs text-[var(--ink-faint)]">Google Trends feed position</dt><dd className="mt-1 font-semibold text-[var(--ink)]">{topic.sourcePosition ?? "Unknown"} · newest-first, not volume rank</dd></div>
              <div className="rounded-xl bg-[var(--surface-muted)] p-3"><dt className="text-xs text-[var(--ink-faint)]">Approximate traffic</dt><dd className="mt-1 font-semibold text-[var(--ink)]">{topic.approximateTrafficRaw ?? "Unknown"}</dd></div>
              <div className="rounded-xl bg-[var(--surface-muted)] p-3"><dt className="text-xs text-[var(--ink-faint)]">Fetched / first seen</dt><dd className="mt-1 font-semibold text-[var(--ink)]">{topic.firstSeenAt}</dd></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2"><Flag aria-hidden="true" size={17} className="text-[var(--accent)]" /><h2 className="text-sm font-semibold text-[var(--ink)]">Risk flags</h2></div>
            {topic.riskFlags.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--ink-muted)]">
                {topic.riskFlags.map((flag) => (
                  <li key={flag} className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
                    {flag}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                No rule-based flag was triggered. AI suggestions are unavailable while AI mode is off.
              </p>
            )}
            <p className="mt-3 text-xs leading-5 text-[var(--ink-faint)]">
              A flag is information, never a block.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--ink)]">Search the platforms</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {deepLinks.map(([label, url]) => (
                <a key={label} href={url} target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-center text-xs font-semibold text-[var(--ink)] hover:border-[var(--line-strong)] hover:text-[var(--accent)]">{label}</a>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">Deep links are fallbacks. The app does not scrape TikTok, Instagram, X, or Reddit pages.</p>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <TopicNotes topicId={topic.id} />
          </section>
        </aside>
      </div>
    </PageShell>
  );
}

