"use client";

import { BellRing, Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface LocalWatch {
  id: string;
  type: "keyword" | "entity" | "category" | "market";
  value: string;
  score: number;
  momentum: number;
  eventWithinDays: number | null;
  topicId?: string;
}

function readWatches(): LocalWatch[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem("ctr:watch-rules") ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function WatchlistView() {
  const [watches, setWatches] = useState<LocalWatch[]>([]);
  const [type, setType] = useState<LocalWatch["type"]>("keyword");
  const [value, setValue] = useState("");
  const [score, setScore] = useState(60);
  const [momentum, setMomentum] = useState(50);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setWatches(readWatches()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function persist(next: LocalWatch[]) {
    setWatches(next);
    window.localStorage.setItem("ctr:watch-rules", JSON.stringify(next));
  }

  function addWatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = [
      ...watches,
      {
        id: crypto.randomUUID(),
        type,
        value: trimmed,
        score,
        momentum,
        eventWithinDays: null,
      },
    ];
    persist(next);
    setValue("");
    setMessage("Watch rule saved in this browser. The worker will evaluate it after persistent storage is configured.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">Watch rules</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Match a keyword, entity, category, or market, then apply evidence thresholds.
            </p>
          </div>
          <Badge tone="info">12h dedup</Badge>
        </div>

        <form onSubmit={addWatch} className="mt-5 rounded-2xl bg-[var(--surface-muted)] p-4">
          <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
            <div>
              <label htmlFor="watch-type" className="text-sm font-semibold text-[var(--ink)]">Type</label>
              <select
                id="watch-type"
                value={type}
                onChange={(event) => setType(event.target.value as LocalWatch["type"])}
                className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
              >
                <option value="keyword">Keyword</option>
                <option value="entity">Entity</option>
                <option value="category">Category</option>
                <option value="market">Market</option>
              </select>
            </div>
            <div>
              <label htmlFor="watch-value" className="text-sm font-semibold text-[var(--ink)]">Value</label>
              <input
                id="watch-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="e.g. Pakistan cricket"
                className="mt-2 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
              />
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[var(--ink)]">
              Score at least <output className="text-[var(--accent)]">{score}</output>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={score}
                onChange={(event) => setScore(Number(event.target.value))}
                className="mt-2 block w-full accent-[var(--accent)]"
              />
            </label>
            <label className="text-sm font-semibold text-[var(--ink)]">
              Momentum at least <output className="text-[var(--accent)]">{momentum}</output>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={momentum}
                onChange={(event) => setMomentum(Number(event.target.value))}
                className="mt-2 block w-full accent-[var(--accent)]"
              />
            </label>
          </div>
          <Button className="mt-4" type="submit">
            <Plus aria-hidden="true" size={16} />
            Add watch rule
          </Button>
        </form>

        {message ? (
          <p className="mt-4 flex gap-2 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--ink-muted)]">
            <Check aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            {message}
          </p>
        ) : null}

        <div className="mt-5 space-y-2">
          {watches.length ? (
            watches.map((watch) => (
              <article key={watch.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] p-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{watch.topicId ? "topic" : watch.type}</Badge>
                    <span className="font-semibold text-[var(--ink)]">{watch.value}</span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--ink-muted)]">
                    Score ≥ {watch.score} · Momentum ≥ {watch.momentum} · alerts deduplicated for 12h
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete watch for ${watch.value}`}
                  onClick={() => persist(watches.filter((item) => item.id !== watch.id))}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--ink-faint)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--line-strong)] px-5 py-10 text-center text-sm text-[var(--ink-muted)]">
              No watch rules yet. Add one above; nothing is monitored silently.
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <BellRing aria-hidden="true" size={18} className="text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--ink)]">Alert inbox</h2>
        </div>
        <div className="mt-5 rounded-xl border border-dashed border-[var(--line-strong)] px-4 py-10 text-center">
          <p className="text-sm font-semibold text-[var(--ink)]">No real alerts yet</p>
          <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
            Alerts appear only after an ingestion cycle matches a saved rule. Quiet hours are 23:00–08:00 Asia/Karachi.
          </p>
        </div>
      </aside>
    </div>
  );
}

