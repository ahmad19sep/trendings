"use client";

import { CalendarDays, ChevronDown, Download, List, MoonStar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { EventConfidence } from "@/lib/upcoming";

import { Badge } from "../ui/badge";

export interface UpcomingViewEvent {
  id: string;
  title: string;
  category: string;
  markets: string[];
  startsAt: string;
  localDate: string | null;
  timezone: string;
  confidence: EventConfidence;
  confidenceLabel: string;
  sourceUrls: string[];
  caveat: string | null;
}

function confidenceTone(confidence: EventConfidence) {
  if (confidence === "confirmed") return "accent" as const;
  if (confidence === "reported") return "info" as const;
  return "warning" as const;
}

function countdown(date: string, referenceTime: number) {
  const days = Math.ceil((Date.parse(date) - referenceTime) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

function EventCard({
  event,
  referenceTime,
}: {
  event: UpcomingViewEvent;
  referenceTime: number;
}) {
  const date = new Intl.DateTimeFormat("en-PK", {
    timeZone: event.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(event.startsAt));

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={confidenceTone(event.confidence)}>{event.confidenceLabel}</Badge>
            <Badge>{event.category}</Badge>
            {event.markets.map((market) => (
              <Badge key={market}>{market}</Badge>
            ))}
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">
            {event.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {date} · {event.timezone}
          </p>
          {event.caveat ? (
            <p className="mt-3 flex max-w-2xl gap-2 rounded-xl bg-[var(--amber-soft)] px-3 py-2 text-xs leading-5 text-[var(--ink-muted)]">
              <MoonStar aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--amber)]" size={15} />
              {event.caveat}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--ink-muted)]">
            <span>Pre-buzz: Collecting history</span>
            {event.sourceUrls.map((url, index) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--accent)] hover:underline"
              >
                Source {index + 1}
              </a>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-center sm:min-w-24">
          <span className="block text-sm font-bold text-[var(--ink)]">
            {countdown(event.startsAt, referenceTime)}
          </span>
          <span className="mt-1 block text-[11px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">
            countdown
          </span>
        </div>
      </div>
    </article>
  );
}

export function UpcomingView({
  events,
  referenceTime,
}: {
  events: UpcomingViewEvent[];
  referenceTime: string;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [category, setCategory] = useState("all");
  const [market, setMarket] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [countdownReference, setCountdownReference] = useState(() =>
    Date.parse(referenceTime),
  );

  useEffect(() => {
    const updateReference = () => setCountdownReference(Date.now());
    const interval = window.setInterval(updateReference, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const filtered = useMemo(
    () =>
      events.filter((event) => {
        if (category !== "all" && event.category !== category) return false;
        if (market !== "all" && !event.markets.includes(market)) return false;
        if (confidence !== "all" && event.confidence !== confidence) return false;
        return true;
      }),
    [category, confidence, events, market],
  );
  const eventCategories = [...new Set(events.map((event) => event.category))];

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative">
            <label htmlFor="upcoming-category" className="sr-only">Category</label>
            <select
              id="upcoming-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-3 pr-8 text-sm text-[var(--ink)]"
            >
              <option value="all">All categories</option>
              {eventCategories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
          <div className="relative">
            <label htmlFor="upcoming-market" className="sr-only">Market</label>
            <select
              id="upcoming-market"
              value={market}
              onChange={(event) => setMarket(event.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-3 pr-8 text-sm text-[var(--ink)]"
            >
              <option value="all">All markets</option>
              <option value="PK">Pakistan</option>
              <option value="IN">India</option>
              <option value="US">United States</option>
            </select>
            <ChevronDown aria-hidden="true" size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
          <div className="relative">
            <label htmlFor="upcoming-confidence" className="sr-only">Confidence</label>
            <select
              id="upcoming-confidence"
              value={confidence}
              onChange={(event) => setConfidence(event.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-3 pr-8 text-sm text-[var(--ink)]"
            >
              <option value="all">All confidence</option>
              <option value="confirmed">Confirmed</option>
              <option value="reported">Reported</option>
              <option value="expected_lunar">Expected lunar</option>
              <option value="ai_extracted">AI-extracted</option>
            </select>
            <ChevronDown aria-hidden="true" size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-[var(--surface-muted)] p-1">
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className="grid size-8 place-items-center rounded-lg text-[var(--ink-muted)] aria-pressed:bg-[var(--surface)] aria-pressed:text-[var(--accent)]"
            >
              <List aria-hidden="true" size={16} />
              <span className="sr-only">List view</span>
            </button>
            <button
              type="button"
              aria-pressed={view === "calendar"}
              onClick={() => setView("calendar")}
              className="grid size-8 place-items-center rounded-lg text-[var(--ink-muted)] aria-pressed:bg-[var(--surface)] aria-pressed:text-[var(--accent)]"
            >
              <CalendarDays aria-hidden="true" size={16} />
              <span className="sr-only">Calendar view</span>
            </button>
          </div>
          <a
            href="/upcoming.ics"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
          >
            <Download aria-hidden="true" size={16} />
            iCal
          </a>
        </div>
      </div>

      {filtered.length ? (
        view === "list" ? (
          <div className="mt-4 space-y-3">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                referenceTime={countdownReference}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                referenceTime={countdownReference}
              />
            ))}
          </div>
        )
      ) : (
        <div className="mt-4 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-5 text-center">
          <CalendarDays aria-hidden="true" size={28} className="text-[var(--accent)]" />
          <h2 className="mt-3 text-lg font-semibold text-[var(--ink)]">No verified event in this 30-day view</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--ink-muted)]">
            The curated Pakistan calendar has no matching event in this window, or the selected filters are restrictive. Cricket, films, Wikipedia, and lunar feeds appear after their connectors are configured and verified.
          </p>
        </div>
      )}
    </div>
  );
}

