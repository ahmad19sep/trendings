"use server";

import { revalidatePath } from "next/cache";

import { isDatabaseConfigured } from "@/db/client";
import { requireSession } from "@/lib/auth";
import type { ScoreWeights } from "@/lib/scoring";
import { storeScoreWeights } from "@/lib/settings/score-weights";

export interface SaveScoreWeightsResult {
  ok: boolean;
  message: string;
  weights?: ScoreWeights;
}

export async function saveScoreWeightsAction(
  weights: ScoreWeights,
): Promise<SaveScoreWeightsResult> {
  await requireSession();
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      message: "Configure PostgreSQL before saving score weights.",
    };
  }

  try {
    const stored = await storeScoreWeights(weights);
    revalidatePath("/settings");
    return {
      ok: true,
      message: "Saved. New worker score runs will use these weights.",
      weights: stored,
    };
  } catch (error) {
    console.error("Unable to save score weights", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return {
      ok: false,
      message: "Weights could not be saved. Check the database and try again.",
    };
  }
}
