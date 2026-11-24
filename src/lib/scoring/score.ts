import {
  COMPONENT_KEYS,
  type ComponentAssessments,
  type ComponentKey,
  type ContentabilityScore,
  type ScoreOptions,
  type ScoreWeights,
} from "./types";

export const DEFAULT_SCORE_WEIGHTS: Readonly<ScoreWeights> = Object.freeze({
  momentum: 20,
  reach: 15,
  nativeRank: 10,
  freshness: 10,
  gap: 10,
  explainability: 10,
  shelfLife: 10,
  audienceRelevance: 15,
});

export const DEFAULT_SCORE_VERSION = "contentability-v1";

const EPSILON = 1e-8;

function assertWeights(weights: ScoreWeights): void {
  const total = COMPONENT_KEYS.reduce((sum, key) => {
    const value = weights[key];
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`Weight for ${key} must be a non-negative number.`);
    }
    return sum + value;
  }, 0);

  if (Math.abs(total - 100) > EPSILON) {
    throw new RangeError(`Score weights must sum to 100; received ${total}.`);
  }
}

function assertComponentValue(key: ComponentKey, value: number | null): void {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
    throw new RangeError(`${key} must be null or between 0 and 100.`);
  }
}

export function computeContentabilityScore(
  assessments: ComponentAssessments,
  options: ScoreOptions = {},
): ContentabilityScore {
  const weights = options.weights ?? DEFAULT_SCORE_WEIGHTS;
  assertWeights(weights);

  const disabled = new Set(options.disabledComponents ?? []);
  const includedKeys = COMPONENT_KEYS.filter((key) => {
    const assessment = assessments[key];
    assertComponentValue(key, assessment.value);
    return !disabled.has(key) && assessment.value !== null;
  });
  const includedBaseWeight = includedKeys.reduce(
    (sum, key) => sum + weights[key],
    0,
  );

  if (includedBaseWeight <= 0) {
    throw new RangeError("At least one score component with positive weight is required.");
  }

  const breakdown = COMPONENT_KEYS.map((key) => {
    const assessment = assessments[key];
    const enabled = !disabled.has(key);
    const included = enabled && assessment.value !== null && weights[key] > 0;
    const effectiveWeight = included
      ? (weights[key] / includedBaseWeight) * 100
      : 0;
    const contribution = included
      ? (assessment.value as number) * (effectiveWeight / 100)
      : null;

    return {
      ...assessment,
      excludedReason: enabled ? assessment.excludedReason : "disabled" as const,
      baseWeight: weights[key],
      effectiveWeight,
      contribution,
      enabled,
      included,
    };
  });

  const scoreExact = breakdown.reduce(
    (sum, component) => sum + (component.contribution ?? 0),
    0,
  );
  const collectingHistory =
    assessments.momentum.excludedReason === "collecting_history";
  const recomputedWithout = breakdown
    .filter((component) => !component.included)
    .map((component) => component.key);

  return {
    score: Math.round(scoreExact),
    scoreExact,
    scoreVersion: options.scoreVersion ?? DEFAULT_SCORE_VERSION,
    provisional: collectingHistory,
    collectingHistory,
    recomputedWithout,
    breakdown,
  };
}

