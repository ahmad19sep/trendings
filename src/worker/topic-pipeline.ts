import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lt,
  sql,
} from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";
import type { Category } from "../domain/taxonomy";
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
  type ContentabilityScore,
  type NativeRankSignal,
  type ScoreWeights,
} from "../lib/scoring";
import {
  categorizeTitleByRules,
  ruleShelfLife,
} from "../lib/topics/rules";

type Database = NodePgDatabase<typeof schema>;

const PIPELINE_LOCK_ID = 1_907_112_024;
const CANDIDATE_WINDOW_MS = 72 * 60 * 60 * 1_000;
const BASELINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1_000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1_000;
const NATIVE_SIGNAL_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const TITLE_CLUSTER_THRESHOLD = 0.58;

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "aur",
  "for",
  "from",
  "hai",
  "in",
  "is",
  "ka",
  "ke",
  "ki",
  "ko",
  "mein",
  "ne",
  "of",
  "on",
  "par",
  "se",
  "the",
  "to",
  "with",
]);

export interface TopicPipelineInput {
  itemIds: readonly string[];
  listLength: number;
  observedAt?: Date;
}

export interface TopicPipelineResult {
  itemCount: number;
  itemsLinked: number;
  topicsCreated: number;
  topicIds: string[];
}

export interface TopicObservationInputs {
  now: Date;
  firstSeenAt: Date;
  mentionsLast6Hours: number;
  mentionsLast3Hours: number;
  mentionsPrior3Hours: number;
  baselineMean6Hours: number | null;
  distinctOutlets: number;
  platformSignalCount: number;
  nativeSignals: readonly NativeRankSignal[];
  worldPresence: number;
  worldOutlets: number;
  pkUrduHindiOutlets: number;
  isPakistanOriginStory: boolean;
  storyLocations: readonly string[];
  coverageLanguages: readonly string[];
  category: Category;
  weights?: ScoreWeights;
}

interface CandidateTopic {
  id: string;
  titleOriginal: string;
  titleEn: string | null;
  lastActivityAt: Date;
}

export function normalizeTopicTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function topicTitleTokens(title: string): string[] {
  const normalized = normalizeTopicTitle(title);
  if (!normalized) return [];
  const meaningful = normalized
    .split(" ")
    .filter((token) => token.length > 1 && !TITLE_STOP_WORDS.has(token));
  return [...new Set(meaningful.length >= 2 ? meaningful : normalized.split(" "))];
}

/**
 * Rules-only title match used while embeddings are disabled. Exact normalized
 * titles score 1. Otherwise the score combines Jaccard overlap with containment
 * and requires at least two shared meaningful tokens.
 */
export function titleSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeTopicTitle(left);
  const normalizedRight = normalizeTopicTitle(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftTokens = new Set(topicTitleTokens(normalizedLeft));
  const rightTokens = new Set(topicTitleTokens(normalizedRight));
  if (leftTokens.size < 2 || rightTokens.size < 2) return 0;

  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  if (shared < 2) return 0;

  const union = new Set([...leftTokens, ...rightTokens]).size;
  const jaccard = shared / union;
  const containment = shared / Math.min(leftTokens.size, rightTokens.size);
  let score = 0.65 * jaccard + 0.35 * containment;

  const shorterLength = Math.min(normalizedLeft.length, normalizedRight.length);
  if (
    shorterLength >= 12 &&
    (normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft))
  ) {
    score = Math.max(score, 0.88);
  }

  return Math.min(1, score);
}

export function scoreTopicObservation(
  input: TopicObservationInputs,
): ContentabilityScore {
  const historyHours = Math.max(
    0,
    (input.now.getTime() - input.firstSeenAt.getTime()) / 3_600_000,
  );
  const assessments = {
    momentum: scoreMomentum({
      mentionsLast6Hours: input.mentionsLast6Hours,
      baselineMean6Hours: input.baselineMean6Hours,
      mentionsLast3Hours: input.mentionsLast3Hours,
      mentionsPrior3Hours: input.mentionsPrior3Hours,
      historyHours,
      hasGdeltBaseline: false,
      topicAgeHours: historyHours,
      distinctOutlets: input.distinctOutlets,
    }),
    reach: scoreReach({
      distinctOutlets: input.distinctOutlets,
      platformSignalCount: input.platformSignalCount,
    }),
    nativeRank: scoreNativeRank(input.nativeSignals),
    freshness: scoreFreshness(historyHours),
    gap: scoreGap({
      worldPresence: input.worldPresence,
      pkUrduHindiOutlets: input.pkUrduHindiOutlets,
      worldOutlets: input.worldOutlets,
      isPakistanOriginStory: input.isPakistanOriginStory,
    }),
    explainability: scoreExplainability({
      substantiveSources: input.distinctOutlets,
      aiMode: "off",
      aiRating: null,
    }),
    shelfLife: scoreShelfLife({
      aiMode: "off",
      aiAssessment: null,
      ruleAssessment: ruleShelfLife(input.category),
      linkedToUpcomingEvent: false,
    }),
    audienceRelevance: scoreAudienceRelevance({
      storyLocations: input.storyLocations,
      coverageLanguages: input.coverageLanguages,
      primaryCategory: input.category,
      aiMode: "off",
      aiRating: null,
    }),
  };
  return computeContentabilityScore(
    assessments,
    input.weights ? { weights: input.weights } : {},
  );
}

function parseStoredWeights(value: unknown): ScoreWeights {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_SCORE_WEIGHTS };
  }
  const record = value as Record<string, unknown>;
  const weights = {} as ScoreWeights;
  let total = 0;
  for (const key of COMPONENT_KEYS) {
    const weight = record[key];
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
      return { ...DEFAULT_SCORE_WEIGHTS };
    }
    weights[key] = weight;
    total += weight;
  }
  return Math.abs(total - 100) < 0.001
    ? weights
    : { ...DEFAULT_SCORE_WEIGHTS };
}

function outletKey(item: {
  registrableDomain: string | null;
  outletName: string | null;
  sourceId: string;
}): string {
  return (
    item.registrableDomain?.toLocaleLowerCase("en") ??
    item.outletName?.trim().toLocaleLowerCase("en") ??
    `source:${item.sourceId}`
  );
}

function countBy(values: readonly (string | null)[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    if (value) counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function unique(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function bestCandidate(
  item: { titleOriginal: string; titleEn: string | null },
  candidates: readonly CandidateTopic[],
): { candidate: CandidateTopic; similarity: number } | null {
  let best: { candidate: CandidateTopic; similarity: number } | null = null;
  for (const candidate of candidates) {
    const originalSimilarity = titleSimilarity(
      item.titleOriginal,
      candidate.titleOriginal,
    );
    const translatedSimilarity =
      item.titleEn && candidate.titleEn
        ? titleSimilarity(item.titleEn, candidate.titleEn)
        : 0;
    const similarity = Math.max(originalSimilarity, translatedSimilarity);
    if (similarity < TITLE_CLUSTER_THRESHOLD) continue;
    if (
      !best ||
      similarity > best.similarity ||
      (similarity === best.similarity && candidate.id < best.candidate.id)
    ) {
      best = { candidate, similarity };
    }
  }
  return best;
}

export async function materializeItemsIntoTopics(
  db: Database,
  input: TopicPipelineInput,
): Promise<TopicPipelineResult> {
  const itemIds = [...new Set(input.itemIds)];
  if (itemIds.length === 0) {
    return {
      itemCount: 0,
      itemsLinked: 0,
      topicsCreated: 0,
      topicIds: [],
    };
  }

  return db.transaction(async (tx) => {
    // All topic matching is serialized so two independent feed queues cannot
    // create parallel topics for the same headline before either link exists.
    await tx.execute(sql`select pg_advisory_xact_lock(${PIPELINE_LOCK_ID})`);
    const observedAt = input.observedAt ?? new Date();

    const [storedWeights] = await tx
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, "score_weights"))
      .limit(1);
    const scoreWeights = parseStoredWeights(storedWeights?.value);

    const incoming = await tx
      .select({
        id: schema.items.id,
        sourceId: schema.items.sourceId,
        connector: schema.items.connector,
        titleOriginal: schema.items.titleOriginal,
        titleEn: schema.items.titleEn,
        language: schema.items.language,
        registrableDomain: schema.items.registrableDomain,
        outletName: schema.items.outletName,
        publisherCountry: schema.items.publisherCountry,
        firstSeenAt: schema.items.firstSeenAt,
        lastSeenAt: schema.items.lastSeenAt,
        fetchedAt: schema.items.fetchedAt,
        nativePosition: schema.items.nativePosition,
        nativeMetricName: schema.items.nativeMetricName,
        nativeMetricValue: schema.items.nativeMetricValue,
        nativeMetricUnit: schema.items.nativeMetricUnit,
        trendMarket: schema.items.trendMarket,
        storyLocations: schema.items.storyLocations,
        targetAudiences: schema.items.targetAudiences,
      })
      .from(schema.items)
      .where(inArray(schema.items.id, itemIds));
    incoming.sort(
      (left, right) =>
        left.firstSeenAt.getTime() - right.firstSeenAt.getTime() ||
        left.id.localeCompare(right.id),
    );

    const existingLinks = await tx
      .select({
        itemId: schema.topicItems.itemId,
        topicId: schema.topicItems.topicId,
      })
      .from(schema.topicItems)
      .where(inArray(schema.topicItems.itemId, itemIds));
    const existingByItem = new Map(
      existingLinks.map((link) => [link.itemId, link.topicId]),
    );

    const candidates: CandidateTopic[] = await tx
      .select({
        id: schema.topics.id,
        titleOriginal: schema.topics.titleOriginal,
        titleEn: schema.topics.titleEn,
        lastActivityAt: schema.topics.lastActivityAt,
      })
      .from(schema.topics)
      .where(
        and(
          eq(schema.topics.status, "active"),
          gte(
            schema.topics.lastActivityAt,
            new Date(observedAt.getTime() - CANDIDATE_WINDOW_MS),
          ),
        ),
      )
      .orderBy(desc(schema.topics.lastActivityAt), asc(schema.topics.id))
      .limit(500);

    const linked = new Map<string, string>();
    const affected = new Set<string>();
    let topicsCreated = 0;
    let itemsLinked = 0;

    for (const item of incoming) {
      const existingTopicId = existingByItem.get(item.id);
      if (existingTopicId) {
        linked.set(item.id, existingTopicId);
        affected.add(existingTopicId);
        continue;
      }

      const match = bestCandidate(item, candidates);
      let topicId: string;
      let similarity: number;
      if (match) {
        topicId = match.candidate.id;
        similarity = match.similarity;
      } else {
        const category = categorizeTitleByRules(item.titleOriginal);
        const [created] = await tx
          .insert(schema.topics)
          .values({
            titleOriginal: item.titleOriginal,
            titleEn: item.titleEn,
            primaryCategory: category,
            trendMarkets: item.trendMarket ? [item.trendMarket] : [],
            storyLocations: item.storyLocations,
            targetAudiences: item.targetAudiences,
            firstSeenAt: item.firstSeenAt,
            lastActivityAt: item.lastSeenAt,
            distinctOutletCount: 1,
            platformCount: 1,
          })
          .returning({ id: schema.topics.id });
        if (!created) throw new Error("Could not create topic.");
        topicId = created.id;
        similarity = 1;
        topicsCreated += 1;
        candidates.push({
          id: topicId,
          titleOriginal: item.titleOriginal,
          titleEn: item.titleEn,
          lastActivityAt: item.lastSeenAt,
        });
      }

      await tx
        .insert(schema.topicItems)
        .values({
          topicId,
          itemId: item.id,
          similarity,
          matchMethod: match ? "title-rules-v1" : "topic-seed-v1",
          addedAt: observedAt,
        })
        .onConflictDoNothing({
          target: [schema.topicItems.topicId, schema.topicItems.itemId],
        });
      linked.set(item.id, topicId);
      affected.add(topicId);
      itemsLinked += 1;
    }

    for (const item of incoming) {
      const topicId = linked.get(item.id);
      if (
        !topicId ||
        item.nativePosition === null ||
        input.listLength < item.nativePosition ||
        input.listLength < 1
      ) {
        continue;
      }
      const [duplicate] = await tx
        .select({ id: schema.nativeSignals.id })
        .from(schema.nativeSignals)
        .where(
          and(
            eq(schema.nativeSignals.topicId, topicId),
            eq(schema.nativeSignals.sourceId, item.sourceId),
            eq(schema.nativeSignals.fetchedAt, item.fetchedAt),
            eq(schema.nativeSignals.position, item.nativePosition),
            eq(schema.nativeSignals.listLength, input.listLength),
          ),
        )
        .limit(1);
      if (!duplicate) {
        await tx.insert(schema.nativeSignals).values({
          topicId,
          sourceId: item.sourceId,
          market: item.trendMarket,
          metricName: item.nativeMetricName ?? "source_list_position",
          metricValue: item.nativeMetricValue,
          unit: item.nativeMetricUnit,
          position: item.nativePosition,
          listLength: input.listLength,
          fetchedAt: item.fetchedAt,
          metadata: {
            itemId: item.id,
            connector: item.connector,
          },
        });
      }
    }

    for (const topicId of affected) {
      const [topic] = await tx
        .select()
        .from(schema.topics)
        .where(eq(schema.topics.id, topicId))
        .limit(1);
      if (!topic) continue;

      const topicEvidence = await tx
        .select({
          id: schema.items.id,
          sourceId: schema.items.sourceId,
          connector: schema.items.connector,
          titleEn: schema.items.titleEn,
          language: schema.items.language,
          registrableDomain: schema.items.registrableDomain,
          outletName: schema.items.outletName,
          publisherCountry: schema.items.publisherCountry,
          firstSeenAt: schema.items.firstSeenAt,
          lastSeenAt: schema.items.lastSeenAt,
          fetchedAt: schema.items.fetchedAt,
          nativePosition: schema.items.nativePosition,
          trendMarket: schema.items.trendMarket,
          storyLocations: schema.items.storyLocations,
          targetAudiences: schema.items.targetAudiences,
        })
        .from(schema.topicItems)
        .innerJoin(
          schema.items,
          eq(schema.topicItems.itemId, schema.items.id),
        )
        .where(eq(schema.topicItems.topicId, topicId));
      if (topicEvidence.length === 0) continue;

      const firstSeenAt = new Date(
        Math.min(...topicEvidence.map((item) => item.firstSeenAt.getTime())),
      );
      const lastActivityAt = new Date(
        Math.max(...topicEvidence.map((item) => item.lastSeenAt.getTime())),
      );
      const category = categorizeTitleByRules(topic.titleOriginal);
      const markets = unique(topicEvidence.map((item) => item.trendMarket));
      const storyLocations = unique(
        topicEvidence.flatMap((item) => item.storyLocations),
      );
      const targetAudiences = unique(
        topicEvidence.flatMap((item) => item.targetAudiences),
      );
      const coverageLanguages = unique(
        topicEvidence.map((item) => item.language),
      );
      const distinctOutletKeys = new Set(topicEvidence.map(outletKey));
      const platformSignalCount = new Set(
        topicEvidence
          .filter((item) => item.nativePosition !== null)
          .map((item) => item.connector),
      ).size;
      const sixHoursAgo = new Date(observedAt.getTime() - SIX_HOURS_MS);
      const threeHoursAgo = new Date(observedAt.getTime() - THREE_HOURS_MS);
      const mentionsLast6Hours = topicEvidence.filter(
        (item) => item.lastSeenAt >= sixHoursAgo,
      ).length;
      const mentionsLast3Hours = topicEvidence.filter(
        (item) => item.lastSeenAt >= threeHoursAgo,
      ).length;
      const mentionsPrior3Hours = topicEvidence.filter(
        (item) =>
          item.lastSeenAt >= sixHoursAgo && item.lastSeenAt < threeHoursAgo,
      ).length;

      const historicalSnapshots = await tx
        .select({ mentionCount: schema.topicSnapshots.mentionCount })
        .from(schema.topicSnapshots)
        .where(
          and(
            eq(schema.topicSnapshots.topicId, topicId),
            gte(
              schema.topicSnapshots.observedAt,
              new Date(observedAt.getTime() - BASELINE_WINDOW_MS),
            ),
            lt(schema.topicSnapshots.observedAt, sixHoursAgo),
          ),
        );
      const baselineMean6Hours = historicalSnapshots.length
        ? historicalSnapshots.reduce(
            (sum, snapshot) => sum + snapshot.mentionCount,
            0,
          ) / historicalSnapshots.length
        : null;

      const nativeRows = await tx
        .select({
          position: schema.nativeSignals.position,
          listLength: schema.nativeSignals.listLength,
          market: schema.nativeSignals.market,
        })
        .from(schema.nativeSignals)
        .where(
          and(
            eq(schema.nativeSignals.topicId, topicId),
            gte(
              schema.nativeSignals.fetchedAt,
              new Date(observedAt.getTime() - NATIVE_SIGNAL_WINDOW_MS),
            ),
          ),
        )
        .orderBy(desc(schema.nativeSignals.fetchedAt));
      const nativeRankSignals: NativeRankSignal[] = nativeRows.flatMap((row) =>
        row.position !== null && row.listLength !== null
          ? [
              {
                position: row.position,
                listLength: row.listLength,
                market: row.market ?? "unknown",
              },
            ]
          : [],
      );

      const foreignMarkets = new Set(markets.filter((market) => market !== "PK"));
      const worldOutletKeys = new Set(
        topicEvidence
          .filter(
            (item) =>
              (item.trendMarket !== null && item.trendMarket !== "PK") ||
              (item.publisherCountry !== null && item.publisherCountry !== "PK"),
          )
          .map(outletKey),
      );
      const audienceLanguages = new Set(["ur", "ur-Latn", "hi", "hi-Latn"]);
      const localAudienceOutletKeys = new Set(
        topicEvidence
          .filter(
            (item) =>
              (item.trendMarket === "PK" || item.publisherCountry === "PK") &&
              audienceLanguages.has(item.language),
          )
          .map(outletKey),
      );
      const isPakistanOriginStory =
        storyLocations.includes("PK") || category === "Pakistan Politics";
      const score = scoreTopicObservation({
        now: observedAt,
        firstSeenAt,
        mentionsLast6Hours,
        mentionsLast3Hours,
        mentionsPrior3Hours,
        baselineMean6Hours,
        distinctOutlets: distinctOutletKeys.size,
        platformSignalCount,
        nativeSignals: nativeRankSignals,
        worldPresence: Math.min(1, foreignMarkets.size / 5),
        worldOutlets: worldOutletKeys.size,
        pkUrduHindiOutlets: localAudienceOutletKeys.size,
        isPakistanOriginStory,
        storyLocations,
        coverageLanguages,
        category,
        weights: scoreWeights,
      });

      await tx
        .update(schema.topics)
        .set({
          titleEn:
            topic.titleEn ??
            topicEvidence.find((item) => item.titleEn)?.titleEn ??
            null,
          primaryCategory: category,
          trendMarkets: markets,
          storyLocations,
          targetAudiences,
          firstSeenAt,
          lastActivityAt,
          distinctOutletCount: distinctOutletKeys.size,
          platformCount: platformSignalCount,
          scoreVersion: score.scoreVersion,
          updatedAt: observedAt,
        })
        .where(eq(schema.topics.id, topicId));

      const marketCounts = countBy(
        topicEvidence.map((item) => item.trendMarket),
      );
      const sourceTypeCounts = countBy(
        topicEvidence.map((item) => item.connector),
      );
      await tx
        .insert(schema.topicSnapshots)
        .values({
          topicId,
          observedAt,
          mentionCount: mentionsLast6Hours,
          distinctOutlets: distinctOutletKeys.size,
          markets: marketCounts,
          sourceTypes: sourceTypeCounts,
        })
        .onConflictDoUpdate({
          target: [
            schema.topicSnapshots.topicId,
            schema.topicSnapshots.observedAt,
          ],
          set: {
            mentionCount: mentionsLast6Hours,
            distinctOutlets: distinctOutletKeys.size,
            markets: marketCounts,
            sourceTypes: sourceTypeCounts,
          },
        });
      await tx
        .insert(schema.scores)
        .values({
          topicId,
          score: score.scoreExact,
          provisional: score.provisional,
          collectingHistory: score.collectingHistory,
          breakdown: score.breakdown,
          scoreVersion: score.scoreVersion,
          computedAt: observedAt,
        })
        .onConflictDoUpdate({
          target: [
            schema.scores.topicId,
            schema.scores.scoreVersion,
            schema.scores.computedAt,
          ],
          set: {
            score: score.scoreExact,
            provisional: score.provisional,
            collectingHistory: score.collectingHistory,
            breakdown: score.breakdown,
          },
        });
    }

    return {
      itemCount: incoming.length,
      itemsLinked,
      topicsCreated,
      topicIds: [...affected],
    };
  });
}
