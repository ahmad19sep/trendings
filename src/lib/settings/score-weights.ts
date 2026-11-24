import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import {
  DEFAULT_SCORE_WEIGHTS,
  type ScoreWeights,
} from "@/lib/scoring";

export const SCORE_WEIGHTS_SETTING_KEY = "score_weights";

const scoreWeightsSchema = z
  .strictObject({
    momentum: z.number().min(0).max(100),
    reach: z.number().min(0).max(100),
    nativeRank: z.number().min(0).max(100),
    freshness: z.number().min(0).max(100),
    gap: z.number().min(0).max(100),
    explainability: z.number().min(0).max(100),
    shelfLife: z.number().min(0).max(100),
    audienceRelevance: z.number().min(0).max(100),
  })
  .refine(
    (value) =>
      Math.abs(
        Object.values(value).reduce((total, weight) => total + weight, 0) -
          100,
      ) < 0.001,
    { message: "Score weights must total 100." },
  );

export function parseScoreWeights(value: unknown): ScoreWeights | null {
  const parsed = scoreWeightsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function loadScoreWeights(
  db: ReturnType<typeof getDb> = getDb(),
): Promise<ScoreWeights> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SCORE_WEIGHTS_SETTING_KEY))
    .limit(1);

  return (
    parseScoreWeights(row?.value) ?? { ...DEFAULT_SCORE_WEIGHTS }
  );
}

export async function storeScoreWeights(
  weights: unknown,
  db: ReturnType<typeof getDb> = getDb(),
): Promise<ScoreWeights> {
  const parsed = scoreWeightsSchema.parse(weights);
  await db
    .insert(settings)
    .values({ key: SCORE_WEIGHTS_SETTING_KEY, value: parsed })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: parsed, updatedAt: new Date() },
    });
  return parsed;
}
