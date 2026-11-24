"use client";

import { ChevronDown, Globe2, Minus, RadioTower } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { DashboardTopic } from "@/lib/dashboard/types";

import { Badge } from "../ui/badge";

const markets = [
  { value: "PK", label: "Pakistan" },
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "WORLD", label: "Worldwide union" },
] as const;

function hasMarket(topic: DashboardTopic, market: string) {
  if (market === "WORLD") return topic.markets.some((value) => value !== "PK");
  return topic.markets.includes(market);
}

function TopicRows({
  topics,
  empty,
}: {
  topics: DashboardTopic[];
  empty: string;
}) {
  if (!topics.length) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-5 text-center">
        <Minus aria-hidden="true" size={20} className="text-[var(--ink-faint)]" />
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{empty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {topics.map((topic) => (
        <Link
          key={topic.id}
          href={`/topic/${topic.id}`}
          className="block rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition hover:border-[var(--line-strong)] hover:shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-sm font-bold tabular-nums text-[var(--accent)]">
              {topic.score}
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)]">
                <bdi>{topic.titleOriginal}</bdi>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topic.markets.map((market) => (
                  <Badge key={market}>{market}</Badge>
                ))}
                <span className="text-xs text-[var(--ink-muted)]">
                  {topic.distinctOutletCount} outlets
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function CompareMarketsView({ topics }: { topics: DashboardTopic[] }) {
  const [marketA, setMarketA] = useState("PK");
  const [marketB, setMarketB] = useState("WORLD");

  const comparison = useMemo(() => {
    const onlyA = topics.filter(
      (topic) => hasMarket(topic, marketA) && !hasMarket(topic, marketB),
    );
    const both = topics.filter(
      (topic) => hasMarket(topic, marketA) && hasMarket(topic, marketB),
    );
    const onlyB = topics.filter(
      (topic) => !hasMarket(topic, marketA) && hasMarket(topic, marketB),
    );
    return { onlyA, both, onlyB };
  }, [marketA, marketB, topics]);

  return (
    <div>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div>
            <label htmlFor="market-a" className="text-sm font-semibold text-[var(--ink)]">
              Market A
            </label>
            <div className="relative mt-2">
              <select
                id="market-a"
                value={marketA}
                onChange={(event) => setMarketA(event.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 pr-9 text-sm text-[var(--ink)]"
              >
                {markets.map((market) => (
                  <option key={market.value} value={market.value}>
                    {market.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" size={16} />
            </div>
          </div>
          <span className="hidden pb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-faint)] sm:block">
            versus
          </span>
          <div>
            <label htmlFor="market-b" className="text-sm font-semibold text-[var(--ink)]">
              Market B
            </label>
            <div className="relative mt-2">
              <select
                id="market-b"
                value={marketB}
                onChange={(event) => setMarketB(event.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 pr-9 text-sm text-[var(--ink)]"
              >
                {markets.map((market) => (
                  <option key={market.value} value={market.value}>
                    {market.label}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" size={16} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 rounded-xl bg-[var(--info-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--ink-muted)]">
          <RadioTower aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--info)]" size={15} />
          <p>
            Matched source: Google Trends RSS. Window: items this app observed in the current live fetch. Worldwide requires non-Pakistan market observations; missing coverage is never filled in.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center gap-2">
            <Globe2 aria-hidden="true" size={17} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--ink)]">Big in B, missing in A</h2>
            <Badge>{comparison.onlyB.length}</Badge>
          </div>
          <TopicRows
            topics={comparison.onlyB}
            empty="No supported signal proves a B-only gap in the current window."
          />
        </section>
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--ink)]">Both</h2>
            <Badge>{comparison.both.length}</Badge>
          </div>
          <TopicRows topics={comparison.both} empty="No topic was observed in both selected markets." />
        </section>
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--ink)]">Only A</h2>
            <Badge>{comparison.onlyA.length}</Badge>
          </div>
          <TopicRows topics={comparison.onlyA} empty="No topic is exclusive to market A in the current window." />
        </section>
      </div>
    </div>
  );
}

