"use client";

import { RotateCcw, Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { saveScoreWeightsAction } from "@/app/actions/settings";
import {
  COMPONENT_KEYS,
  DEFAULT_SCORE_WEIGHTS,
  type ComponentKey,
  type ScoreWeights,
} from "@/lib/scoring";

import { Button } from "../ui/button";

const labels: Record<ComponentKey, string> = {
  momentum: "Early momentum",
  reach: "Cross-source reach",
  nativeRank: "Source-native rank",
  freshness: "Freshness",
  gap: "Pakistan-vs-world gap",
  explainability: "Explainability",
  shelfLife: "Shelf life",
  audienceRelevance: "Urdu/Hindi relevance",
};

function redistribute(
  current: ScoreWeights,
  key: ComponentKey,
  value: number,
): ScoreWeights {
  const clamped = Math.max(0, Math.min(100, value));
  const remaining = 100 - clamped;
  const otherKeys = COMPONENT_KEYS.filter((item) => item !== key);
  const priorOthers = otherKeys.reduce((sum, item) => sum + current[item], 0);
  const next = { ...current, [key]: clamped };
  let assigned = 0;

  otherKeys.forEach((item, index) => {
    const calculated =
      index === otherKeys.length - 1
        ? remaining - assigned
        : priorOthers === 0
          ? remaining / otherKeys.length
          : (current[item] / priorOthers) * remaining;
    next[item] = calculated;
    assigned += calculated;
  });

  return next;
}

export function ScoreSettings({
  initialWeights,
  persistenceAvailable,
}: {
  initialWeights: ScoreWeights;
  persistenceAvailable: boolean;
}) {
  const [weights, setWeights] = useState<ScoreWeights>({ ...initialWeights });
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const total = useMemo(
    () => COMPONENT_KEYS.reduce((sum, key) => sum + weights[key], 0),
    [weights],
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">Score weights</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
            Weights always total 100. Changing one redistributes the difference across the rest in proportion.
          </p>
        </div>
        <div className="rounded-xl bg-[var(--accent-soft)] px-4 py-2 text-center">
          <span className="block text-xl font-bold text-[var(--accent)]">{total.toFixed(0)}%</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">total weight</span>
        </div>
      </div>
      <div className="mt-5 grid gap-x-6 gap-y-4 lg:grid-cols-2">
        {COMPONENT_KEYS.map((key) => (
          <label key={key} className="block">
            <span className="flex items-center justify-between text-sm font-semibold text-[var(--ink)]">
              {labels[key]}
              <output className="tabular-nums text-[var(--accent)]">{weights[key].toFixed(1)}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              value={weights[key]}
              onChange={(event) => {
                setStatus(null);
                setWeights((current) => redistribute(current, key, Number(event.target.value)));
              }}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </label>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setWeights({ ...DEFAULT_SCORE_WEIGHTS });
            setStatus(null);
          }}
        >
          <RotateCcw aria-hidden="true" size={16} />
          Reset defaults
        </Button>
        <Button
          disabled={!persistenceAvailable || isPending}
          onClick={() => {
            startTransition(async () => {
              const result = await saveScoreWeightsAction(weights);
              setStatus(result.message);
              if (result.weights) setWeights(result.weights);
            });
          }}
        >
          <Save aria-hidden="true" size={16} />
          {isPending ? "Saving…" : "Save weights"}
        </Button>
        <span className="text-sm text-[var(--ink-muted)]">
          {status ??
            (persistenceAvailable
              ? "Saved weights apply to subsequent worker score runs."
              : "Configure PostgreSQL to save and apply custom weights.")}
        </span>
      </div>
    </div>
  );
}

