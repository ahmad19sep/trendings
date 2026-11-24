export type PreBuzzStatus =
  | "Rising"
  | "Building"
  | "Quiet"
  | "Collecting history";

export type PreBuzzResult = {
  status: PreBuzzStatus;
  recentMentions: number;
  previousMentions: number | null;
  ratio: number | null;
  ratioLabel: string;
  baselineAvailable: boolean;
  explanation: string;
};

export function computePreBuzz(input: {
  /** Matching mentions observed in the most recent 72 hours. */
  recentMentions: number;
  /** Matching mentions in the preceding seven-day comparison window. */
  previousMentions: number | null;
  /** False when the application has not observed the full comparison window. */
  previousWindowComplete?: boolean;
}): PreBuzzResult {
  const recentMentions = nonNegativeInteger(
    input.recentMentions,
    "recentMentions",
  );
  const previousMentions =
    input.previousMentions === null
      ? null
      : nonNegativeInteger(input.previousMentions, "previousMentions");
  const previousWindowComplete = input.previousWindowComplete ?? true;

  if (previousMentions === null || !previousWindowComplete) {
    return {
      status: "Collecting history",
      recentMentions,
      previousMentions,
      ratio: null,
      ratioLabel: "Not available",
      baselineAvailable: false,
      explanation:
        "A complete preceding seven-day observation window is not available yet.",
    };
  }

  if (previousMentions === 0) {
    if (recentMentions >= 5) {
      return zeroBaselineResult(
        "Rising",
        recentMentions,
        "At least five mentions appeared after a complete zero-mention baseline.",
      );
    }
    if (recentMentions > 0) {
      return zeroBaselineResult(
        "Building",
        recentMentions,
        "New mentions appeared after a complete zero-mention baseline, but fewer than five were observed.",
      );
    }
    return {
      status: "Quiet",
      recentMentions,
      previousMentions,
      ratio: 0,
      ratioLabel: "0×",
      baselineAvailable: true,
      explanation: "No matching mentions were observed in either window.",
    };
  }

  const ratio = recentMentions / previousMentions;
  const roundedRatio = Math.round(ratio * 100) / 100;
  if (ratio >= 2 && recentMentions >= 5) {
    return availableResult("Rising", recentMentions, previousMentions, roundedRatio);
  }
  if (ratio >= 1.3) {
    return availableResult(
      "Building",
      recentMentions,
      previousMentions,
      roundedRatio,
    );
  }
  return availableResult("Quiet", recentMentions, previousMentions, roundedRatio);
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative integer.`);
  }
  return value;
}

function zeroBaselineResult(
  status: Extract<PreBuzzStatus, "Rising" | "Building">,
  recentMentions: number,
  explanation: string,
): PreBuzzResult {
  return {
    status,
    recentMentions,
    previousMentions: 0,
    ratio: null,
    ratioLabel: "New (0 baseline)",
    baselineAvailable: true,
    explanation,
  };
}

function availableResult(
  status: Extract<PreBuzzStatus, "Rising" | "Building" | "Quiet">,
  recentMentions: number,
  previousMentions: number,
  ratio: number,
): PreBuzzResult {
  return {
    status,
    recentMentions,
    previousMentions,
    ratio,
    ratioLabel: `${ratio.toFixed(2)}×`,
    baselineAvailable: true,
    explanation: `${recentMentions} mentions in the last 72 hours versus ${previousMentions} in the preceding seven-day window.`,
  };
}

