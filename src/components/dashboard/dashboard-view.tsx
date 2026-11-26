"use client";

import {
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  Layers3,
  RadioTower,
  Search,
  Share2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Category } from "@/domain/taxonomy";
import { categories } from "@/domain/taxonomy";
import { cn } from "@/lib/cn";
import type { DashboardResult, DashboardTopic } from "@/lib/dashboard/types";
import { getReadableTitle } from "@/lib/language/readable-title";

import { EmptyState } from "../empty-state";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type Tab = "top" | "rising" | "category" | "market" | "sources";
type Sort = "score" | "momentum" | "freshness" | "reach" | "gap";
type MarketFilter = "all" | "PK" | "IN" | "WORLD";

interface StoredWatchRule {
  id: string;
  type: "keyword" | "entity" | "category" | "market";
  value: string;
  score: number;
  momentum: number;
  eventWithinDays: number | null;
  topicId?: string;
}

interface StoredPreset {
  market: MarketFilter;
  category: Category | "all";
  minScore: number;
  showCollecting: boolean;
  search: string;
  sort: Sort;
  activeTab?: Tab;
}

const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "top", label: "Today’s Top" },
  { id: "rising", label: "Rising" },
  { id: "category", label: "By Category" },
  { id: "market", label: "By Market" },
  { id: "sources", label: "Sources" },
];

const componentColors = [
  "#0f8f81",
  "#3ba48a",
  "#5b80c7",
  "#7f6dc2",
  "#cb8a36",
  "#d45f73",
  "#57a8b3",
  "#8b9a48",
];

function formatAge(minutes: number): string {
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getComponent(topic: DashboardTopic, key: string) {
  return topic.scoreBreakdown.find((component) => component.key === key);
}

function storedSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function storedWatchRules(): StoredWatchRule[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem("ctr:watch-rules") ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (rule): rule is StoredWatchRule =>
        typeof rule === "object" &&
        rule !== null &&
        typeof (rule as Partial<StoredWatchRule>).id === "string" &&
        typeof (rule as Partial<StoredWatchRule>).value === "string",
    );
  } catch {
    return [];
  }
}

function isSort(value: unknown): value is Sort {
  return ["score", "momentum", "freshness", "reach", "gap"].includes(
    String(value),
  );
}

function isTab(value: unknown): value is Tab {
  return ["top", "rising", "category", "market", "sources"].includes(
    String(value),
  );
}

function isCategory(value: unknown): value is Category {
  return categories.includes(value as Category);
}

function isMarket(value: unknown): value is MarketFilter {
  return ["all", "PK", "IN", "WORLD"].includes(String(value));
}

function parsePreset(value: string | null): StoredPreset | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Partial<StoredPreset>;
    if (
      !isMarket(candidate.market) ||
      (candidate.category !== "all" && !isCategory(candidate.category)) ||
      typeof candidate.minScore !== "number" ||
      !Number.isFinite(candidate.minScore) ||
      typeof candidate.showCollecting !== "boolean" ||
      typeof candidate.search !== "string" ||
      !isSort(candidate.sort) ||
      (candidate.activeTab !== undefined && !isTab(candidate.activeTab))
    ) {
      return null;
    }
    return {
      market: candidate.market,
      category: candidate.category,
      minScore: Math.max(0, Math.min(100, candidate.minScore)),
      showCollecting: candidate.showCollecting,
      search: candidate.search,
      sort: candidate.sort,
      activeTab: candidate.activeTab,
    };
  } catch {
    return null;
  }
}

function FilterPanel({
  idPrefix,
  market,
  setMarket,
  category,
  setCategory,
  minScore,
  setMinScore,
  showCollecting,
  setShowCollecting,
  search,
  setSearch,
  onSave,
}: {
  idPrefix: string;
  market: string;
  setMarket: (value: string) => void;
  category: Category | "all";
  setCategory: (value: Category | "all") => void;
  minScore: number;
  setMinScore: (value: number) => void;
  showCollecting: boolean;
  setShowCollecting: (value: boolean) => void;
  search: string;
  setSearch: (value: string) => void;
  onSave: () => void;
}) {
  const searchId = `${idPrefix}-filter-search`;
  const marketId = `${idPrefix}-filter-market`;
  const categoryId = `${idPrefix}-filter-category`;
  const scoreId = `${idPrefix}-filter-score`;
  const collectingId = `${idPrefix}-filter-collecting`;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor={searchId} className="text-sm font-semibold text-[var(--ink)]">
          Keywords
        </label>
        <div className="relative mt-2">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
            size={16}
          />
          <input
            id={searchId}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Include title text"
            className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
          />
        </div>
      </div>

      <div>
        <label htmlFor={marketId} className="text-sm font-semibold text-[var(--ink)]">
          Geography
        </label>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          Applies to trend market. Publisher country and story location remain separate.
        </p>
        <div className="relative mt-2">
          <select
            id={marketId}
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 pr-9 text-sm text-[var(--ink)]"
          >
            <option value="all">All monitored markets</option>
            <option value="PK">Pakistan</option>
            <option value="IN">India</option>
            <option value="WORLD">Worldwide union</option>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
            size={16}
          />
        </div>
      </div>

      <div>
        <label htmlFor={categoryId} className="text-sm font-semibold text-[var(--ink)]">
          Category
        </label>
        <div className="relative mt-2">
          <select
            id={categoryId}
            value={category}
            onChange={(event) => setCategory(event.target.value as Category | "all")}
            className="h-11 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 pr-9 text-sm text-[var(--ink)]"
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
            size={16}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={scoreId} className="text-sm font-semibold text-[var(--ink)]">
            Minimum score
          </label>
          <output htmlFor={scoreId} className="text-sm font-semibold tabular-nums text-[var(--accent)]">
            {minScore}
          </output>
        </div>
        <input
          id={scoreId}
          type="range"
          min="0"
          max="100"
          step="5"
          value={minScore}
          onChange={(event) => setMinScore(Number(event.target.value))}
          className="mt-3 w-full accent-[var(--accent)]"
        />
      </div>

      <label
        htmlFor={collectingId}
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3"
      >
        <input
          id={collectingId}
          type="checkbox"
          checked={showCollecting}
          onChange={(event) => setShowCollecting(event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--accent)]"
        />
        <span>
          <span className="block text-sm font-semibold text-[var(--ink)]">
            Show collecting history
          </span>
          <span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">
            These scores are provisional until a baseline exists.
          </span>
        </span>
      </label>

      <Button variant="secondary" className="w-full" onClick={onSave}>
        <Check aria-hidden="true" size={16} />
        Save as preset
      </Button>
    </div>
  );
}

function ScoreBar({ topic }: { topic: DashboardTopic }) {
  const included = topic.scoreBreakdown.filter(
    (component) => component.included && component.contribution !== null,
  );
  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]"
      aria-label={`Score ${topic.score} out of 100. ${included
        .map(
          (component) =>
            `${component.key} ${component.contribution?.toFixed(1)} points`,
        )
        .join(", ")}`}
      role="img"
    >
      {included.map((component, index) => (
        <span
          key={component.key}
          style={{
            width: `${component.contribution ?? 0}%`,
            backgroundColor: componentColors[index % componentColors.length],
          }}
        />
      ))}
    </div>
  );
}

function TopicCard({
  topic,
  bookmarked,
  watched,
  onBookmark,
  onWatch,
}: {
  topic: DashboardTopic;
  bookmarked: boolean;
  watched: boolean;
  onBookmark: () => void;
  onWatch: () => void;
}) {
  const readableTitle = getReadableTitle(
    topic.titleOriginal,
    topic.titleEnglish,
  );

  return (
    <article className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(15,39,45,0.03)] transition hover:border-[var(--line-strong)] hover:shadow-[var(--shadow)] sm:p-5">
      <div className="flex items-start gap-4">
        <Link
          href={`/topic/${topic.id}`}
          className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--surface-muted)] sm:size-16"
          aria-label={`Open evidence for ${readableTitle.text}`}
        >
          <span className="text-xl font-semibold tabular-nums tracking-[-0.04em] text-[var(--accent)] sm:text-2xl">
            {topic.score}
          </span>
          <span className="absolute bottom-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
            score
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{topic.category}</Badge>
            {topic.collectingHistory ? (
              <Badge tone="warning">Collecting history</Badge>
            ) : null}
            {readableTitle.romanized ? <Badge tone="info">Romanized</Badge> : null}
            {topic.markets.map((market) => (
              <Badge key={market}>{market}</Badge>
            ))}
          </div>
          <Link href={`/topic/${topic.id}`} className="mt-3 block">
            <h2
              className={cn(
                "text-balance text-[17px] font-semibold leading-6 tracking-[-0.02em] text-[var(--ink)] group-hover:text-[var(--accent)] sm:text-lg",
                readableTitle.language === "ur" && "font-urdu text-xl leading-[2]",
                readableTitle.language === "hi" && "font-hindi",
              )}
              lang={readableTitle.language}
              dir={readableTitle.language === "ur" ? "rtl" : "ltr"}
            >
              <bdi>{readableTitle.text}</bdi>
            </h2>
          </Link>
          {readableTitle.text !== topic.titleOriginal ? (
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
                Original
              </span>
              <bdi>{topic.titleOriginal}</bdi>
            </p>
          ) : null}

          <div className="mt-4">
            <ScoreBar topic={topic} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--ink-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 aria-hidden="true" size={14} />
              {formatAge(topic.ageMinutes)}
            </span>
            <span>{topic.distinctOutletCount} distinct outlets</span>
            {topic.sourcePosition ? (
              <span>
                {topic.sourceName} position {topic.sourcePosition}
              </span>
            ) : null}
            {topic.approximateTrafficRaw ? (
              <span>Provider traffic: {topic.approximateTrafficRaw}</span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <button
            type="button"
            onClick={onBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark topic"}
            className="grid size-9 place-items-center rounded-lg text-[var(--ink-faint)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:text-[var(--accent)]"
          >
            <Bookmark aria-hidden="true" size={18} fill={bookmarked ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={onWatch}
            aria-pressed={watched}
            aria-label={watched ? "Stop watching topic" : "Watch topic"}
            className="grid size-9 place-items-center rounded-lg text-[var(--ink-faint)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:text-[var(--accent)]"
          >
            <Bell aria-hidden="true" size={18} fill={watched ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </article>
  );
}

function RawSourceList({ topics }: { topics: DashboardTopic[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink)]">Google Trends · Pakistan</h2>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Native provider order, shown unscored. Position is not a volume rank.
          </p>
        </div>
        <Badge tone="info">Raw source</Badge>
      </div>
      <ol className="divide-y divide-[var(--line)]">
        {[...topics]
          .sort((a, b) => (a.sourcePosition ?? 999) - (b.sourcePosition ?? 999))
          .map((topic) => {
            const readableTitle = getReadableTitle(
              topic.titleOriginal,
              topic.titleEnglish,
            );
            return (
            <li key={topic.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <span className="w-6 text-center text-sm font-semibold tabular-nums text-[var(--ink-faint)]">
                {topic.sourcePosition ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/topic/${topic.id}`}
                  className="line-clamp-2 text-sm font-semibold text-[var(--ink)] hover:text-[var(--accent)]"
                >
                  <bdi>{readableTitle.text}</bdi>
                </Link>
                {readableTitle.romanized ? (
                  <span className="mt-1 inline-flex text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
                    Romanized
                  </span>
                ) : null}
                {readableTitle.text !== topic.titleOriginal ? (
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--ink-muted)]">
                    <span className="mr-1 font-semibold">Original</span>
                    <bdi>{topic.titleOriginal}</bdi>
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {formatAge(topic.ageMinutes)}
                  {topic.approximateTrafficRaw
                    ? ` · approx. traffic ${topic.approximateTrafficRaw}`
                    : ""}
                </p>
              </div>
            </li>
            );
          })}
      </ol>
    </div>
  );
}

export function DashboardView({ result }: { result: DashboardResult }) {
  const [activeTab, setActiveTab] = useState<Tab>("top");
  const [sort, setSort] = useState<Sort>("score");
  const [market, setMarket] = useState<MarketFilter>("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [showCollecting, setShowCollecting] = useState(true);
  const [search, setSearch] = useState("");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [watches, setWatches] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBookmarks(storedSet("ctr:bookmarks"));
      setWatches(
        new Set(
          storedWatchRules().flatMap((rule) =>
            typeof rule.topicId === "string" ? [rule.topicId] : [],
          ),
        ),
      );

      const params = new URLSearchParams(window.location.search);
      const hasSharedFilters = [
        "market",
        "category",
        "minScore",
        "collecting",
        "q",
        "sort",
        "tab",
      ].some((key) => params.has(key));

      if (hasSharedFilters) {
        const sharedMarket = params.get("market");
        const sharedCategory = params.get("category");
        const sharedScore = Number(params.get("minScore"));
        const sharedSort = params.get("sort");
        const sharedTab = params.get("tab");

        if (isMarket(sharedMarket)) setMarket(sharedMarket);
        if (sharedCategory === "all" || isCategory(sharedCategory)) {
          setCategory(sharedCategory);
        }
        if (Number.isFinite(sharedScore)) {
          setMinScore(Math.max(0, Math.min(100, sharedScore)));
        }
        if (params.has("collecting")) {
          setShowCollecting(params.get("collecting") !== "0");
        }
        if (params.has("q")) setSearch(params.get("q") ?? "");
        if (isSort(sharedSort)) setSort(sharedSort);
        if (isTab(sharedTab)) setActiveTab(sharedTab);
        return;
      }

      const preset = parsePreset(window.localStorage.getItem("ctr:last-preset"));
      if (!preset) return;
      setMarket(preset.market);
      setCategory(preset.category);
      setMinScore(preset.minScore);
      setShowCollecting(preset.showCollecting);
      setSearch(preset.search);
      setSort(preset.sort);
      if (preset.activeTab) setActiveTab(preset.activeTab);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("en");
    const items = result.topics.filter((topic) => {
      if (market !== "all" && !topic.markets.includes(market)) return false;
      if (category !== "all" && topic.category !== category) return false;
      if (topic.score < minScore) return false;
      if (!showCollecting && topic.collectingHistory) return false;
      if (normalizedSearch) {
        const readableTitle = getReadableTitle(
          topic.titleOriginal,
          topic.titleEnglish,
        );
        const matchesTitle = [
          readableTitle.text,
          topic.titleOriginal,
          topic.titleEnglish,
        ].some((value) =>
          value?.toLocaleLowerCase("en").includes(normalizedSearch),
        );
        if (!matchesTitle) return false;
      }
      if (activeTab === "top" && topic.ageMinutes > 24 * 60) return false;
      if (activeTab === "rising") {
        const momentum = getComponent(topic, "momentum");
        if (!momentum?.included) return false;
      }
      return true;
    });

    return items.sort((a, b) => {
      if (sort === "freshness") return a.ageMinutes - b.ageMinutes;
      if (sort === "reach") return b.distinctOutletCount - a.distinctOutletCount;
      if (sort === "momentum") {
        return (getComponent(b, "momentum")?.value ?? -1) - (getComponent(a, "momentum")?.value ?? -1);
      }
      if (sort === "gap") {
        return (getComponent(b, "gap")?.value ?? -1) - (getComponent(a, "gap")?.value ?? -1);
      }
      return b.score - a.score;
    });
  }, [activeTab, category, market, minScore, result.topics, search, showCollecting, sort]);

  function toggleBookmark(id: string) {
    const next = new Set(bookmarks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBookmarks(next);
    window.localStorage.setItem("ctr:bookmarks", JSON.stringify([...next]));
  }

  function toggleWatch(topic: DashboardTopic) {
    const currentRules = storedWatchRules();
    const nextTopics = new Set(watches);
    let nextRules: StoredWatchRule[];

    if (nextTopics.has(topic.id)) {
      nextTopics.delete(topic.id);
      nextRules = currentRules.filter((rule) => rule.topicId !== topic.id);
    } else {
      nextTopics.add(topic.id);
      nextRules = [
        ...currentRules,
        {
          id: `topic:${topic.id}`,
          type: "keyword",
          value: topic.titleOriginal,
          score: 60,
          momentum: 50,
          eventWithinDays: null,
          topicId: topic.id,
        },
      ];
    }

    setWatches(nextTopics);
    window.localStorage.setItem("ctr:watch-rules", JSON.stringify(nextRules));
  }

  function savePreset() {
    const preset: StoredPreset = {
      market,
      category,
      minScore,
      showCollecting,
      search,
      sort,
      activeTab,
    };
    window.localStorage.setItem("ctr:last-preset", JSON.stringify(preset));
    setNotice("Preset saved in this browser. Database sync starts when PostgreSQL is configured.");
  }

  async function shareFilters() {
    const url = new URL(window.location.href);
    url.searchParams.set("market", market);
    url.searchParams.set("category", category);
    url.searchParams.set("minScore", String(minScore));
    url.searchParams.set("collecting", showCollecting ? "1" : "0");
    url.searchParams.set("sort", sort);
    url.searchParams.set("tab", activeTab);
    if (search) url.searchParams.set("q", search);
    else url.searchParams.delete("q");
    await navigator.clipboard.writeText(url.toString());
    setNotice("Shareable filter URL copied. No credentials were included.");
  }

  function filterPanel(idPrefix: string) {
    return (
      <FilterPanel
        idPrefix={idPrefix}
        market={market}
        setMarket={(value) => {
          if (isMarket(value)) setMarket(value);
        }}
        category={category}
        setCategory={setCategory}
        minScore={minScore}
        setMinScore={setMinScore}
        showCollecting={showCollecting}
        setShowCollecting={setShowCollecting}
        search={search}
        setSearch={setSearch}
        onSave={savePreset}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-thin flex overflow-x-auto rounded-xl bg-[var(--surface-muted)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className="min-h-10 shrink-0 rounded-lg px-3.5 text-sm font-semibold text-[var(--ink-muted)] transition hover:text-[var(--ink)] aria-pressed:bg-[var(--surface)] aria-pressed:text-[var(--ink)] aria-pressed:shadow-sm"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <label htmlFor="dashboard-sort" className="sr-only">
              Sort topics
            </label>
            <select
              id="dashboard-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="h-10 appearance-none rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-3 pr-9 text-sm font-semibold text-[var(--ink)]"
            >
              <option value="score">Sort: score</option>
              <option value="momentum">Sort: momentum</option>
              <option value="freshness">Sort: freshness</option>
              <option value="reach">Sort: reach</option>
              <option value="gap">Sort: gap</option>
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
              size={16}
            />
          </div>
          <Button variant="secondary" onClick={shareFilters}>
            <Share2 aria-hidden="true" size={16} />
            <span className="hidden sm:inline">Share filters</span>
          </Button>
          <Button
            variant="secondary"
            className="lg:hidden"
            onClick={() => dialogRef.current?.showModal()}
          >
            <Filter aria-hidden="true" size={16} />
            Filters
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>
            <X aria-hidden="true" size={17} />
          </button>
        </div>
      ) : null}

      {result.warning ? (
        <div className="mt-4 flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--amber-soft)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
          <RadioTower aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--amber)]" size={18} />
          <div>
            <span className="font-semibold">
              {result.mode === "live-preview" ? "Live preview" : "Coverage notice"}
            </span>
            <span className="ml-2">{result.warning}</span>
            {result.coverage.length ? (
              <span className="ml-2 text-[var(--ink-muted)]">
                Coverage: {result.coverage.join(", ")}.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden h-fit rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 lg:block">
          <div className="mb-5 flex items-center gap-2 border-b border-[var(--line)] pb-4">
            <SlidersHorizontal aria-hidden="true" size={17} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--ink)]">Filters</h2>
          </div>
          {filterPanel("desktop")}
        </aside>

        <section aria-live="polite">
          {activeTab === "sources" && filtered.length ? (
            <RawSourceList topics={filtered} />
          ) : filtered.length ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 text-xs text-[var(--ink-muted)]">
                <span>{filtered.length} real topics in this view</span>
                <span>Cursor page 1 · up to 25</span>
              </div>
              {activeTab === "category" ? (
                [...new Set(filtered.map((topic) => topic.category))].map((group) => (
                  <section key={group} className="space-y-3">
                    <div className="flex items-center gap-2 pt-3">
                      <Layers3 aria-hidden="true" size={16} className="text-[var(--accent)]" />
                      <h2 className="text-sm font-semibold text-[var(--ink)]">{group}</h2>
                      <Badge>{filtered.filter((topic) => topic.category === group).length}</Badge>
                    </div>
                    {filtered
                      .filter((topic) => topic.category === group)
                      .slice(0, 5)
                      .map((topic) => (
                        <TopicCard
                          key={topic.id}
                          topic={topic}
                          bookmarked={bookmarks.has(topic.id)}
                          watched={watches.has(topic.id)}
                          onBookmark={() =>
                            toggleBookmark(topic.id)
                          }
                          onWatch={() =>
                            toggleWatch(topic)
                          }
                        />
                      ))}
                  </section>
                ))
              ) : (
                filtered.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    bookmarked={bookmarks.has(topic.id)}
                    watched={watches.has(topic.id)}
                    onBookmark={() =>
                      toggleBookmark(topic.id)
                    }
                    onWatch={() =>
                      toggleWatch(topic)
                    }
                  />
                ))
              )}
            </div>
          ) : (
            <EmptyState
              icon={activeTab === "rising" ? RadioTower : Filter}
              title={
                activeTab === "rising"
                  ? "Momentum needs stored history"
                  : "No topics match this view"
              }
              description={
                activeTab === "rising"
                  ? "The app will rank Rising topics after 24 hours of snapshots or a real GDELT baseline. Nothing is invented in the meantime."
                  : "One or more filters are restrictive, or the live source is unavailable. Reset the minimum score, market, category, and keyword filters."
              }
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMarket("all");
                    setCategory("all");
                    setMinScore(0);
                    setShowCollecting(true);
                    setSearch("");
                    setActiveTab("top");
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          )}
        </section>
      </div>

      <dialog
        ref={dialogRef}
        className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/45 lg:hidden"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl border-t border-[var(--line)] bg-[var(--surface)] p-5 text-[var(--ink)] shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Filter topics</h2>
            <button
              type="button"
              aria-label="Close filters"
              className="grid size-10 place-items-center rounded-xl bg-[var(--surface-muted)]"
              onClick={() => dialogRef.current?.close()}
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          {filterPanel("mobile")}
          <Button className="mt-5 w-full" onClick={() => dialogRef.current?.close()}>
            Show {filtered.length} topics
          </Button>
        </div>
      </dialog>
    </>
  );
}

