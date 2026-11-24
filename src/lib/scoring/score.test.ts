import { describe, expect, it } from "vitest";

import {
  COMPONENT_KEYS,
  DEFAULT_SCORE_WEIGHTS,
  computeContentabilityScore,
  scoreAudienceRelevance,
  scoreExplainability,
  scoreFreshness,
  scoreGap,
  scoreMomentum,
  scoreNativeRank,
  scoreReach,
  scoreShelfLife,
  type ComponentAssessment,
  type ComponentAssessments,
} from "./index";

function assessment(
  key: ComponentAssessment["key"],
  value: number | null,
  excludedReason?: ComponentAssessment["excludedReason"],
): ComponentAssessment {
  return {
    key,
    value,
    status: value === null ? "missing" : "available",
    method: "computed",
    rawInputs: {},
    howComputed: "test",
    excludedReason,
  };
}

function allAt(value: number): ComponentAssessments {
  return {
    momentum: assessment("momentum", value),
    reach: assessment("reach", value),
    nativeRank: assessment("nativeRank", value),
    freshness: assessment("freshness", value),
    gap: assessment("gap", value),
    explainability: assessment("explainability", value),
    shelfLife: assessment("shelfLife", value),
    audienceRelevance: assessment("audienceRelevance", value),
  };
}

describe("Contentability score aggregation", () => {
  it("keeps the eight default weights at exactly 100", () => {
    expect(Object.keys(DEFAULT_SCORE_WEIGHTS)).toEqual([...COMPONENT_KEYS]);
    expect(
      Object.values(DEFAULT_SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    ).toBe(100);
  });

  it("reproduces the brief's worked example", () => {
    const result = computeContentabilityScore({
      momentum: assessment("momentum", 65),
      reach: assessment("reach", 83),
      nativeRank: assessment("nativeRank", 90),
      freshness: assessment("freshness", 59),
      gap: assessment("gap", 68),
      explainability: assessment("explainability", 74),
      shelfLife: assessment("shelfLife", 60),
      audienceRelevance: assessment("audienceRelevance", 32),
    });

    expect(result.scoreExact).toBeCloseTo(65.35, 10);
    expect(result.score).toBe(65);
    expect(
      result.breakdown.reduce(
        (sum, component) => sum + (component.contribution ?? 0),
        0,
      ),
    ).toBeCloseTo(result.scoreExact, 12);
  });

  it("redistributes missing momentum instead of inventing zero", () => {
    const inputs = allAt(80);
    inputs.momentum = scoreMomentum({
      mentionsLast6Hours: 12,
      baselineMean6Hours: null,
      mentionsLast3Hours: 8,
      mentionsPrior3Hours: 4,
      historyHours: 6,
      hasGdeltBaseline: false,
      topicAgeHours: 6,
      distinctOutlets: 5,
    });

    const result = computeContentabilityScore(inputs);
    const momentum = result.breakdown.find((row) => row.key === "momentum");

    expect(inputs.momentum.value).toBeNull();
    expect(momentum?.contribution).toBeNull();
    expect(result.collectingHistory).toBe(true);
    expect(result.provisional).toBe(true);
    expect(result.scoreExact).toBeCloseTo(80, 12);
    expect(
      result.breakdown.reduce((sum, row) => sum + row.effectiveWeight, 0),
    ).toBeCloseTo(100, 12);
  });

  it("redistributes gap weight for a Pakistan-origin story", () => {
    const inputs = allAt(70);
    inputs.gap = scoreGap({
      worldPresence: 0.9,
      pkUrduHindiOutlets: 1,
      worldOutlets: 12,
      isPakistanOriginStory: true,
    });

    const result = computeContentabilityScore(inputs);
    expect(inputs.gap.value).toBeNull();
    expect(inputs.gap.excludedReason).toBe("local_story");
    expect(result.recomputedWithout).toContain("gap");
    expect(result.scoreExact).toBeCloseTo(70, 12);
  });

  it("redistributes a user-disabled component and reports it", () => {
    const result = computeContentabilityScore(allAt(60), {
      disabledComponents: ["reach"],
    });

    expect(result.scoreExact).toBeCloseTo(60, 12);
    expect(result.recomputedWithout).toEqual(["reach"]);
    expect(result.breakdown.find((row) => row.key === "reach")).toMatchObject({
      enabled: false,
      included: false,
      effectiveWeight: 0,
      contribution: null,
      excludedReason: "disabled",
    });
  });

  it("rejects invalid custom weights and out-of-range values", () => {
    expect(() =>
      computeContentabilityScore(allAt(50), {
        weights: { ...DEFAULT_SCORE_WEIGHTS, momentum: 19 },
      }),
    ).toThrow(/sum to 100/);

    const invalid = allAt(50);
    invalid.reach = assessment("reach", 101);
    expect(() => computeContentabilityScore(invalid)).toThrow(/between 0 and 100/);
  });
});

describe("component formulas", () => {
  it("computes velocity, acceleration and saturation within bounds", () => {
    const ordinary = scoreMomentum({
      mentionsLast6Hours: 35,
      baselineMean6Hours: 5,
      mentionsLast3Hours: 10,
      mentionsPrior3Hours: 10,
      historyHours: 48,
      hasGdeltBaseline: false,
      topicAgeHours: 9,
      distinctOutlets: 14,
    });
    expect(ordinary.value).toBeCloseTo(25 * Math.log2(6), 10);

    const saturated = scoreMomentum({
      mentionsLast6Hours: 1000,
      baselineMean6Hours: 1,
      mentionsLast3Hours: 800,
      mentionsPrior3Hours: 100,
      historyHours: 168,
      hasGdeltBaseline: false,
      topicAgeHours: 60,
      distinctOutlets: 40,
    });
    expect(saturated.value).toBe(50);
  });

  it("computes reach, native rank, freshness and gap", () => {
    expect(scoreReach({ distinctOutlets: 14, platformSignalCount: 0 }).value).toBeCloseTo(
      82.622605651,
      6,
    );
    expect(
      scoreNativeRank([
        { position: 2, listLength: 10, market: "US" },
        { position: 5, listLength: 10, market: "IN" },
      ]).value,
    ).toBe(95);
    expect(scoreNativeRank([])).toMatchObject({ value: 0, reason: "No native signal" });
    expect(scoreFreshness(9).value).toBeCloseTo(59.46035575, 6);
    expect(
      scoreGap({
        worldPresence: 0.85,
        pkUrduHindiOutlets: 1,
        worldOutlets: 14,
        isPakistanOriginStory: false,
      }).value,
    ).toBeCloseTo(68, 10);
    expect(
      scoreGap({
        worldPresence: 1,
        pkUrduHindiOutlets: 0,
        worldOutlets: 4,
        isPakistanOriginStory: false,
      }),
    ).toMatchObject({ value: 0, reason: "Not big worldwide yet" });
  });

  it("uses transparent rule fallbacks when AI is off or unavailable", () => {
    expect(
      scoreExplainability({
        substantiveSources: 4,
        aiMode: "off",
        aiRating: null,
      }),
    ).toMatchObject({ value: 80, method: "rule-based" });

    expect(
      scoreShelfLife({
        aiMode: "off",
        aiAssessment: null,
        ruleAssessment: "lasting",
        linkedToUpcomingEvent: true,
      }),
    ).toMatchObject({ value: 100, method: "rule-based" });

    expect(
      scoreAudienceRelevance({
        storyLocations: ["PK"],
        coverageLanguages: ["ur"],
        primaryCategory: "Cricket",
        aiMode: "off",
        aiRating: null,
      }),
    ).toMatchObject({ value: 100, method: "rule-based" });
  });

  it("combines AI ratings with rules when AI is available", () => {
    expect(
      scoreExplainability({
        substantiveSources: 4,
        aiMode: "local",
        aiRating: 2,
      }).value,
    ).toBe(73.5);
    expect(
      scoreAudienceRelevance({
        storyLocations: [],
        coverageLanguages: ["hi-Latn"],
        primaryCategory: "World News",
        aiMode: "provider",
        aiRating: 1,
      }).value,
    ).toBe(31.5);
  });

  it("keeps every formula result in the 0–100 range", () => {
    const values = [
      scoreReach({ distinctOutlets: 10_000, platformSignalCount: 100 }).value,
      scoreFreshness(-10).value,
      scoreGap({
        worldPresence: 5,
        pkUrduHindiOutlets: -10,
        worldOutlets: 100,
        isPakistanOriginStory: false,
      }).value,
      scoreShelfLife({
        aiMode: "local",
        aiAssessment: "lasting",
        ruleAssessment: "flash",
        linkedToUpcomingEvent: true,
      }).value,
    ];

    for (const value of values) {
      expect(value).not.toBeNull();
      expect(value as number).toBeGreaterThanOrEqual(0);
      expect(value as number).toBeLessThanOrEqual(100);
    }
  });
});

