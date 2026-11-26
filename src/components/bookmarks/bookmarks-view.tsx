"use client";

import { Bookmark, Download, Save, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { DashboardTopic } from "@/lib/dashboard/types";
import { rowsToCsv } from "@/lib/export/csv";
import { getReadableTitle } from "@/lib/language/readable-title";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface BookmarkMeta {
  notes: string;
  tags: string[];
  frozenScore: number;
  savedAt: string;
}

type BookmarkMap = Record<string, BookmarkMeta>;

function readIds(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem("ctr:bookmarks") ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readMeta(): BookmarkMap {
  try {
    const value = JSON.parse(window.localStorage.getItem("ctr:bookmark-meta") ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function BookmarksView({ topics }: { topics: DashboardTopic[] }) {
  const [ids, setIds] = useState<string[]>([]);
  const [meta, setMeta] = useState<BookmarkMap>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedIds = readIds();
      const storedMeta = readMeta();
      const initialized = { ...storedMeta };
      for (const id of storedIds) {
        const topic = topics.find((item) => item.id === id);
        if (topic && !initialized[id]) {
          initialized[id] = {
            notes: "",
            tags: [],
            frozenScore: topic.score,
            savedAt: new Date().toISOString(),
          };
        }
      }
      setIds(storedIds);
      setMeta(initialized);
      window.localStorage.setItem("ctr:bookmark-meta", JSON.stringify(initialized));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [topics]);

  const bookmarked = useMemo(
    () => ids.map((id) => topics.find((topic) => topic.id === id)).filter((topic): topic is DashboardTopic => Boolean(topic)),
    [ids, topics],
  );

  function persistMeta(next: BookmarkMap) {
    setMeta(next);
    window.localStorage.setItem("ctr:bookmark-meta", JSON.stringify(next));
  }

  function remove(id: string) {
    const nextIds = ids.filter((value) => value !== id);
    const nextMeta = { ...meta };
    delete nextMeta[id];
    setIds(nextIds);
    persistMeta(nextMeta);
    window.localStorage.setItem("ctr:bookmarks", JSON.stringify(nextIds));
  }

  function exportCsv() {
    const rows: unknown[][] = [
      [
        "topic",
        "original_topic",
        "category",
        "frozen_score",
        "current_score",
        "components",
        "flags",
        "first_seen",
        "link",
        "notes",
        "tags",
      ],
      ...bookmarked.map((topic) => {
        const readableTitle = getReadableTitle(
          topic.titleOriginal,
          topic.titleEnglish,
        );
        return [
          readableTitle.text,
          topic.titleOriginal,
          topic.category,
          meta[topic.id]?.frozenScore ?? topic.score,
          topic.score,
          topic.scoreBreakdown
            .map((component) => `${component.key}:${component.value ?? "missing"}`)
            .join(" | "),
          topic.riskFlags.join(" | "),
          topic.firstSeenAt,
          `${window.location.origin}/topic/${topic.id}`,
          meta[topic.id]?.notes ?? "",
          (meta[topic.id]?.tags ?? []).join(" | "),
        ];
      }),
    ];
    const blob = new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "creator-trend-radar-bookmarks.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!bookmarked.length) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 text-center">
        <Bookmark aria-hidden="true" size={28} className="text-[var(--accent)]" />
        <h2 className="mt-3 text-lg font-semibold text-[var(--ink)]">No current bookmarks</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--ink-muted)]">
          Bookmark a real topic from the dashboard. Saved IDs without a current live observation stay preserved but are not fabricated into this view.
        </p>
        <Link href="/" className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white">
          Browse trends
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--ink-muted)]">
          {bookmarked.length} saved topics · frozen score compared with current score
        </p>
        <Button variant="secondary" onClick={exportCsv}>
          <Download aria-hidden="true" size={16} />
          Export CSV
        </Button>
      </div>
      {savedMessage ? (
        <p className="mb-4 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--ink-muted)]">{savedMessage}</p>
      ) : null}
      <div className="space-y-3">
        {bookmarked.map((topic) => {
          const details = meta[topic.id] ?? {
            notes: "",
            tags: [],
            frozenScore: topic.score,
            savedAt: new Date().toISOString(),
          };
          const readableTitle = getReadableTitle(
            topic.titleOriginal,
            topic.titleEnglish,
          );
          return (
            <article key={topic.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-center">
                    <span className="block text-lg font-bold text-[var(--ink)]">{details.frozenScore}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">saved</span>
                  </div>
                  <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-center">
                    <span className="block text-lg font-bold text-[var(--accent)]">{topic.score}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">current</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{topic.category}</Badge>
                    {readableTitle.romanized ? (
                      <Badge tone="info">Romanized</Badge>
                    ) : null}
                    {details.tags.map((value) => (
                      <Badge key={value}>{value}</Badge>
                    ))}
                  </div>
                  <Link href={`/topic/${topic.id}`} className="mt-2 block text-lg font-semibold text-[var(--ink)] hover:text-[var(--accent)]">
                    <bdi>{readableTitle.text}</bdi>
                  </Link>
                  {readableTitle.text !== topic.titleOriginal ? (
                    <p className="mt-1 text-sm text-[var(--ink-muted)]">
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">
                        Original
                      </span>
                      <bdi>{topic.titleOriginal}</bdi>
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={`Remove bookmark for ${readableTitle.text}`}
                  onClick={() => remove(topic.id)}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--ink-faint)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 aria-hidden="true" size={17} />
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px_auto]">
                <div>
                  <label htmlFor={`notes-${topic.id}`} className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">Notes</label>
                  <textarea
                    id={`notes-${topic.id}`}
                    value={details.notes}
                    onChange={(event) =>
                      persistMeta({
                        ...meta,
                        [topic.id]: { ...details, notes: event.target.value },
                      })
                    }
                    rows={2}
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--ink)]"
                    placeholder="Your notes stay separate from provider data."
                  />
                </div>
                <div>
                  <label htmlFor={`tags-${topic.id}`} className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)]">Tags</label>
                  <div className="relative mt-2">
                    <Tag aria-hidden="true" size={15} className="absolute left-3 top-3 text-[var(--ink-faint)]" />
                    <input
                      id={`tags-${topic.id}`}
                      value={details.tags.join(", ")}
                      onChange={(event) =>
                        persistMeta({
                          ...meta,
                          [topic.id]: {
                            ...details,
                            tags: event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-9 pr-3 text-sm text-[var(--ink)]"
                      placeholder="research, follow-up"
                    />
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="self-end"
                  onClick={() =>
                    setSavedMessage(
                      `Saved notes for “${readableTitle.text}” in this browser.`,
                    )
                  }
                >
                  <Save aria-hidden="true" size={16} />
                  Save
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

