import type { ComponentAssessment } from "./types";

const AI_RATING_SCORE = [0, 33, 67, 100] as const;
const HIGH_AFFINITY_CATEGORIES = new Set([
  "Cricket",
  "Pakistan Politics",
  "Film & TV",
  "Religion & Culture",
]);
const AUDIENCE_LANGUAGES = new Set(["ur", "ur-Latn", "hi", "hi-Latn"]);

export type AiRating = 0 | 1 | 2 | 3;
export type AiMode = "off" | "local" | "provider";
export type ShelfLifeClass = "flash" | "short" | "lasting";

export interface MomentumInputs {
  mentionsLast6Hours: number;
  baselineMean6Hours: number | null;
  mentionsLast3Hours: number;
  mentionsPrior3Hours: number;
  historyHours: number;
  hasGdeltBaseline: boolean;
  topicAgeHours: number;
  distinctOutlets: number;
}

export interface ReachInputs {
  distinctOutlets: number;
  platformSignalCount: number;
}

export interface NativeRankSignal {
  position: number;
  listLength: number;
  market: string;
}

export interface GapInputs {
  worldPresence: number;
  pkUrduHindiOutlets: number;
  worldOutlets: number;
  isPakistanOriginStory: boolean;
}

export interface ExplainabilityInputs {
  substantiveSources: number;
  aiMode: AiMode;
  aiRating: AiRating | null;
  aiReason?: string;
}

export interface ShelfLifeInputs {
  aiMode: AiMode;
  aiAssessment: ShelfLifeClass | null;
  ruleAssessment: ShelfLifeClass;
  linkedToUpcomingEvent: boolean;
  aiReason?: string;
}

export interface AudienceRelevanceInputs {
  storyLocations: readonly string[];
  coverageLanguages: readonly string[];
  primaryCategory: string;
  aiMode: AiMode;
  aiRating: AiRating | null;
  aiReason?: string;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function nonNegative(value: number): number {
  return Math.max(0, Number.isFinite(value) ? value : 0);
}

function available(
  assessment: Omit<ComponentAssessment, "status">,
): ComponentAssessment {
  return { ...assessment, status: "available" };
}

export function scoreMomentum(inputs: MomentumInputs): ComponentAssessment {
  const rawInputs = { ...inputs };
  const collectingHistory =
    nonNegative(inputs.historyHours) < 24 && !inputs.hasGdeltBaseline;

  if (collectingHistory) {
    return {
      key: "momentum",
      value: null,
      status: "missing",
      method: "computed",
      rawInputs,
      howComputed:
        "Momentum is excluded until 24 hours of snapshots exist or a GDELT baseline is available.",
      reason: "Collecting history",
      excludedReason: "collecting_history",
    };
  }

  if (inputs.baselineMean6Hours === null) {
    return {
      key: "momentum",
      value: null,
      status: "missing",
      method: "computed",
      rawInputs,
      howComputed:
        "Momentum needs a prior seven-day six-hour baseline or a GDELT baseline.",
      reason: "Baseline unavailable",
      excludedReason: "baseline_unavailable",
    };
  }

  const current = nonNegative(inputs.mentionsLast6Hours);
  const baseline = nonNegative(inputs.baselineMean6Hours);
  const velocityRatio = (current + 1) / (baseline + 1);
  let value = clamp(25 * Math.log2(velocityRatio));
  const last3 = nonNegative(inputs.mentionsLast3Hours);
  const prior3 = nonNegative(inputs.mentionsPrior3Hours);
  const accelerating = last3 > prior3 && last3 >= prior3 * 1.5;

  if (accelerating) {
    value = clamp(value + 10);
  }

  const saturated =
    nonNegative(inputs.topicAgeHours) > 48 &&
    nonNegative(inputs.distinctOutlets) >= 40;
  if (saturated) {
    value *= 0.5;
  }

  return available({
    key: "momentum",
    value: clamp(value),
    method: "computed",
    rawInputs: { ...rawInputs, velocityRatio, accelerating, saturated },
    howComputed:
      "M = clamp(25 × log2((c6 + 1) / (baseline + 1)), 0, 100), +10 for 3-hour acceleration, then ×0.5 when saturated.",
  });
}

export function scoreReach(inputs: ReachInputs): ComponentAssessment {
  const outlets = nonNegative(inputs.distinctOutlets);
  const platformSignals = nonNegative(inputs.platformSignalCount);
  const value = clamp(100 * (1 - Math.exp(-outlets / 8)) + 8 * platformSignals);

  return available({
    key: "reach",
    value,
    method: "computed",
    rawInputs: { ...inputs },
    howComputed:
      "R = 100 × (1 − e^(−distinct outlets / 8)) + 8 per platform signal, capped at 100. Manual items contribute zero upstream.",
  });
}

export function scoreNativeRank(
  signals: readonly NativeRankSignal[],
): ComponentAssessment {
  const validSignals = signals.filter(
    (signal) =>
      Number.isFinite(signal.position) &&
      Number.isFinite(signal.listLength) &&
      signal.position >= 1 &&
      signal.listLength >= signal.position,
  );

  if (validSignals.length === 0) {
    return available({
      key: "nativeRank",
      value: 0,
      method: "computed",
      rawInputs: { signals: [] },
      howComputed:
        "No source-native list signal is available, so native rank is 0.",
      reason: "No native signal",
    });
  }

  const perSignal = validSignals.map((signal) => ({
    ...signal,
    normalized: clamp(
      100 * (1 - (signal.position - 1) / signal.listLength),
    ),
  }));
  const marketCount = new Set(perSignal.map((signal) => signal.market)).size;
  const best = Math.max(...perSignal.map((signal) => signal.normalized));
  const value = clamp(best + (marketCount >= 2 ? 5 : 0));

  return available({
    key: "nativeRank",
    value,
    method: "computed",
    rawInputs: {
      signalCount: perSignal.length,
      markets: [...new Set(perSignal.map((signal) => signal.market))],
      bestNormalizedRank: best,
    },
    howComputed:
      "Per list: 100 × (1 − (position − 1) / list length); take the maximum and add 5 when present in at least two markets.",
  });
}

export function scoreFreshness(ageHours: number): ComponentAssessment {
  const safeAgeHours = nonNegative(ageHours);
  const value = clamp(100 * 0.5 ** (safeAgeHours / 12));

  return available({
    key: "freshness",
    value,
    method: "computed",
    rawInputs: { ageHours: safeAgeHours },
    howComputed: "F = 100 × 0.5^(age in hours / 12), from first seen time.",
  });
}

export function scoreGap(inputs: GapInputs): ComponentAssessment {
  const rawInputs = { ...inputs };
  if (inputs.isPakistanOriginStory) {
    return {
      key: "gap",
      value: null,
      status: "not_applicable",
      method: "computed",
      rawInputs,
      howComputed:
        "Pakistan-origin stories do not receive a Pakistan-vs-world gap score; the weight is redistributed.",
      reason: "Local story",
      excludedReason: "local_story",
    };
  }

  if (nonNegative(inputs.worldOutlets) < 5) {
    return available({
      key: "gap",
      value: 0,
      method: "computed",
      rawInputs,
      howComputed:
        "Gap is 0 until at least five worldwide outlets cover the topic.",
      reason: "Not big worldwide yet",
    });
  }

  const worldPresence = clamp(inputs.worldPresence, 0, 1);
  const localCoverage = Math.min(
    1,
    nonNegative(inputs.pkUrduHindiOutlets) / 5,
  );
  const value = clamp(100 * worldPresence * (1 - localCoverage));

  return available({
    key: "gap",
    value,
    method: "computed",
    rawInputs: { ...rawInputs, localCoverage },
    howComputed:
      "G = 100 × world presence × (1 − min(1, PK/Urdu/Hindi outlets / 5)); requires at least five worldwide outlets.",
  });
}

export function scoreExplainability(
  inputs: ExplainabilityInputs,
): ComponentAssessment {
  const rulesScore = clamp(20 * nonNegative(inputs.substantiveSources));
  const useAi = inputs.aiMode !== "off" && inputs.aiRating !== null;
  const value = useAi
    ? (rulesScore + AI_RATING_SCORE[inputs.aiRating as AiRating]) / 2
    : rulesScore;

  return available({
    key: "explainability",
    value: clamp(value),
    method: useAi ? "hybrid" : "rule-based",
    rawInputs: {
      substantiveSources: inputs.substantiveSources,
      rulesScore,
      aiMode: inputs.aiMode,
      aiRating: inputs.aiRating,
    },
    howComputed: useAi
      ? "Average of the rules score (20 per substantive source, capped at 100) and the AI 0–3 rating mapped to 0/33/67/100."
      : "AI is off or unavailable, so the rules score (20 per substantive source, capped at 100) supplies the full component.",
    reason: useAi ? inputs.aiReason : "Rule-based fallback",
  });
}

function shelfLifeValue(assessment: ShelfLifeClass): number {
  return assessment === "flash" ? 20 : assessment === "short" ? 60 : 90;
}

export function scoreShelfLife(inputs: ShelfLifeInputs): ComponentAssessment {
  const useAi = inputs.aiMode !== "off" && inputs.aiAssessment !== null;
  const assessment =
    inputs.aiMode !== "off" && inputs.aiAssessment !== null
      ? inputs.aiAssessment
      : inputs.ruleAssessment;
  const eventBonus = inputs.linkedToUpcomingEvent ? 10 : 0;
  const value = clamp(shelfLifeValue(assessment) + eventBonus);

  return available({
    key: "shelfLife",
    value,
    method: useAi ? "ai-assisted" : "rule-based",
    rawInputs: {
      aiMode: inputs.aiMode,
      assessment,
      linkedToUpcomingEvent: inputs.linkedToUpcomingEvent,
      eventBonus,
    },
    howComputed:
      "Shelf-life class maps flash/short/lasting to 20/60/90, with +10 when linked to an upcoming event.",
    reason: useAi ? inputs.aiReason : "Rule-based category fallback",
  });
}

export function scoreAudienceRelevance(
  inputs: AudienceRelevanceInputs,
): ComponentAssessment {
  const normalizedLocations = new Set(
    inputs.storyLocations.map((location) => location.toUpperCase()),
  );
  const hasLocalLocation =
    normalizedLocations.has("PK") || normalizedLocations.has("IN");
  const hasAudienceLanguage = inputs.coverageLanguages.some((language) =>
    AUDIENCE_LANGUAGES.has(language),
  );
  const isHighAffinity = HIGH_AFFINITY_CATEGORIES.has(inputs.primaryCategory);
  const rulesScore = clamp(
    (hasLocalLocation ? 40 : 0) +
      (hasAudienceLanguage ? 30 : 0) +
      (isHighAffinity ? 30 : 0),
  );
  const useAi = inputs.aiMode !== "off" && inputs.aiRating !== null;
  const value = useAi
    ? (rulesScore + AI_RATING_SCORE[inputs.aiRating as AiRating]) / 2
    : rulesScore;

  return available({
    key: "audienceRelevance",
    value: clamp(value),
    method: useAi ? "hybrid" : "rule-based",
    rawInputs: {
      storyLocations: inputs.storyLocations,
      coverageLanguages: inputs.coverageLanguages,
      primaryCategory: inputs.primaryCategory,
      hasLocalLocation,
      hasAudienceLanguage,
      isHighAffinity,
      rulesScore,
      aiMode: inputs.aiMode,
      aiRating: inputs.aiRating,
    },
    howComputed: useAi
      ? "Average of rules (+40 PK/IN location, +30 Urdu/Hindi coverage, +30 high-affinity category) and the AI 0–3 rating mapped to 0/33/67/100."
      : "AI is off or unavailable, so the rules score (+40 PK/IN location, +30 Urdu/Hindi coverage, +30 high-affinity category) supplies the full component.",
    reason: useAi ? inputs.aiReason : "Rule-based fallback",
  });
}

