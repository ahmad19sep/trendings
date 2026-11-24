export const COMPONENT_KEYS = [
  "momentum",
  "reach",
  "nativeRank",
  "freshness",
  "gap",
  "explainability",
  "shelfLife",
  "audienceRelevance",
] as const;

export type ComponentKey = (typeof COMPONENT_KEYS)[number];

export type ScoreWeights = Record<ComponentKey, number>;

export type ScoreMethod =
  | "computed"
  | "hybrid"
  | "rule-based"
  | "ai-assisted";

export type ComponentStatus = "available" | "missing" | "not_applicable";

export type RawInputValue =
  | string
  | number
  | boolean
  | null
  | readonly string[]
  | readonly number[];

export type RawInputs = Readonly<Record<string, RawInputValue>>;

export interface ComponentAssessment {
  key: ComponentKey;
  value: number | null;
  status: ComponentStatus;
  method: ScoreMethod;
  rawInputs: RawInputs;
  howComputed: string;
  reason?: string;
  excludedReason?:
    | "collecting_history"
    | "baseline_unavailable"
    | "local_story"
    | "disabled"
    | "missing_input";
}

export type ComponentAssessments = Record<ComponentKey, ComponentAssessment>;

export interface ScoreBreakdownRow extends ComponentAssessment {
  baseWeight: number;
  effectiveWeight: number;
  contribution: number | null;
  enabled: boolean;
  included: boolean;
}

export interface ContentabilityScore {
  score: number;
  scoreExact: number;
  scoreVersion: string;
  provisional: boolean;
  collectingHistory: boolean;
  recomputedWithout: ComponentKey[];
  breakdown: ScoreBreakdownRow[];
}

export interface ScoreOptions {
  disabledComponents?: readonly ComponentKey[];
  weights?: ScoreWeights;
  scoreVersion?: string;
}

export type RiskFlagType =
  | "defamation_risk"
  | "graphic_content"
  | "religious_sensitivity"
  | "misinformation_risk"
  | "platform_policy_risk"
  | "legal_sub_judice"
  | "unverified_viral_media";

/** Risk flags are deliberately modeled outside ContentabilityScore. */
export interface RiskFlag {
  type: RiskFlagType;
  severity: "low" | "medium" | "high";
  reason: string;
  evidenceIds: readonly string[];
  source: "rule-based" | "ai-suggestion";
}

