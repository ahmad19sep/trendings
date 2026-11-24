import { describe, expect, it } from "vitest";

import type { ScoreWeights } from "../lib/scoring";

import {
  normalizeTopicTitle,
  scoreTopicObservation,
  TITLE_CLUSTER_THRESHOLD,
  titleSimilarity,
  topicTitleTokens,
} from "./topic-pipeline";

const NOW = new Date("2026-11-24T12:00:00.000Z");

function observation(
  overrides: Partial<Parameters<typeof scoreTopicObservation>[0]> = {},
) {
  return scoreTopicObservation({
    now: NOW,
    firstSeenAt: new Date("2026-11-24T10:00:00.000Z"),
    mentionsLast6Hours: 3,
    mentionsLast3Hours: 2,
    mentionsPrior3Hours: 1,
    baselineMean6Hours: null,
    distinctOutlets: 3,
    platformSignalCount: 2,
    nativeSignals: [{ position: 2, listLength: 10, market: "PK" }],
    worldPresence: 0.2,
    worldOutlets: 2,
    pkUrduHindiOutlets: 1,
    isPakistanOriginStory: false,
    storyLocations: ["PK"],
    coverageLanguages: ["ur"],
    category: "Cricket",
    ...overrides,
  });
}

describe("rules-first topic title clustering", () => {
  it("normalizes Unicode punctuation and whitespace deterministically", () => {
    expect(normalizeTopicTitle("  PSL—Final: Lahore!  ")).toBe(
      "psl final lahore",
    );
    expect(normalizeTopicTitle("پاکستان، کرکٹ")).toBe("پاکستان کرکٹ");
  });

  it("removes common glue words when enough meaningful tokens remain", () => {
    expect(topicTitleTokens("The rise of Pakistan in cricket")).toEqual([
      "rise",
      "pakistan",
      "cricket",
    ]);
  });

  it("clusters reordered variants with two or more meaningful shared terms", () => {
    const score = titleSimilarity(
      "Pakistan beat India in T20 World Cup thriller",
      "T20 World Cup: Pakistan beat India in thriller",
    );
    expect(score).toBeGreaterThanOrEqual(TITLE_CLUSTER_THRESHOLD);
  });

  it("keeps unrelated or weak one-token overlaps separate", () => {
    expect(
      titleSimilarity(
        "Pakistan cricket squad announced",
        "Pakistan inflation report released",
      ),
    ).toBe(0);
  });
});

describe("topic observation scoring", () => {
  it("marks a new topic provisional and redistributes missing momentum", () => {
    const result = observation();
    expect(result.collectingHistory).toBe(true);
    expect(result.provisional).toBe(true);
    expect(
      result.breakdown.find((component) => component.key === "momentum"),
    ).toMatchObject({
      value: null,
      included: false,
      excludedReason: "collecting_history",
    });
    expect(result.score).toBeGreaterThan(0);
  });

  it("uses stored custom weights when supplied", () => {
    const freshnessOnly: ScoreWeights = {
      momentum: 0,
      reach: 0,
      nativeRank: 0,
      freshness: 100,
      gap: 0,
      explainability: 0,
      shelfLife: 0,
      audienceRelevance: 0,
    };
    const result = observation({ weights: freshnessOnly });
    const freshness = result.breakdown.find(
      (component) => component.key === "freshness",
    );
    expect(result.scoreExact).toBeCloseTo(freshness?.value ?? 0, 8);
  });

  it("enables momentum once history and a baseline exist", () => {
    const result = observation({
      firstSeenAt: new Date("2026-11-22T12:00:00.000Z"),
      baselineMean6Hours: 1,
    });
    expect(result.collectingHistory).toBe(false);
    expect(
      result.breakdown.find((component) => component.key === "momentum"),
    ).toMatchObject({ included: true, status: "available" });
  });
});
