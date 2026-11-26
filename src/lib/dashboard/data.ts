import "server-only";

import { createHash } from "node:crypto";

import { desc, eq, inArray, lte, sql } from "drizzle-orm";
import { io } from "next/cache";

import { getDb, isDatabaseConfigured } from "@/db/client";
import { items, riskFlags, scores, topicItems, topics } from "@/db/schema";
import {
  categories,
  supportedLanguages,
  type Category,
  type SupportedLanguage,
} from "@/domain/taxonomy";
import {
  GoogleTrendsRssConnector,
  type RawItem,
} from "@/lib/connectors";
import { safeFetchClient } from "@/lib/connectors/safe-client";
import {
  computeContentabilityScore,
  scoreAudienceRelevance,
  scoreExplainability,
  scoreFreshness,
  scoreMomentum,
  scoreNativeRank,
  scoreReach,
  scoreShelfLife,
  type ComponentAssessments,
  type ContentabilityScore,
} from "@/lib/scoring";
import {
  categorizeTitleByRules,
  detectScriptLanguage,
  ruleShelfLife,
} from "@/lib/topics/rules";
import { requireSession } from "@/lib/auth";

import type { DashboardResult, DashboardTopic } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVANAGARI_SCRIPT_PATTERN = /\p{Script=Devanagari}/u;
const ARABIC_SCRIPT_PATTERN = /\p{Script=Arabic}/u;
const DASHBOARD_TOPIC_LIMIT = 25;
const DASHBOARD_CANDIDATE_LIMIT = 250;

function stableTopicId(item: RawItem): string {
  return createHash("sha256")
    .update(`${item.connector}:${item.externalId}`)
    .digest("hex")
    .slice(0, 20);
}

function ageInHours(date: string | null, now: Date): number {
  if (!date) return 0;
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, (now.getTime() - timestamp) / 3_600_000);
}

function scoreLiveItem(
  item: RawItem,
  category: Category,
  now: Date,
  listLength: number,
): ContentabilityScore {
  const itemAgeHours = ageInHours(item.publishedAt ?? item.fetchedAt, now);
  const outletCount = new Set(
    item.relatedNews.map((evidence) => evidence.source).filter(Boolean),
  ).size;

  const assessments: ComponentAssessments = {
    momentum: scoreMomentum({
      mentionsLast6Hours: 0,
      baselineMean6Hours: null,
      mentionsLast3Hours: 0,
      mentionsPrior3Hours: 0,
      historyHours: 0,
      hasGdeltBaseline: false,
      topicAgeHours: itemAgeHours,
      distinctOutlets: outletCount,
    }),
    reach: scoreReach({
      distinctOutlets: outletCount,
      platformSignalCount: 1,
    }),
    nativeRank: scoreNativeRank(
      item.nativePosition
        ? [
            {
              position: item.nativePosition,
              listLength,
              market: item.trendMarket ?? "unknown",
            },
          ]
        : [],
    ),
    freshness: scoreFreshness(itemAgeHours),
    gap: {
      key: "gap",
      value: null,
      status: "missing",
      method: "computed",
      rawInputs: {
        observedMarkets: item.trendMarket ? [item.trendMarket] : [],
        requiredCoverage: "worldwide and PK Urdu/Hindi outlets",
      },
      howComputed:
        "The Pakistan-vs-world gap is excluded because this live preview only observes one market.",
      reason: "Cross-market coverage unavailable",
      excludedReason: "missing_input",
    },
    explainability: scoreExplainability({
      substantiveSources: outletCount,
      aiMode: "off",
      aiRating: null,
    }),
    shelfLife: scoreShelfLife({
      aiMode: "off",
      aiAssessment: null,
      ruleAssessment: ruleShelfLife(category),
      linkedToUpcomingEvent: false,
    }),
    audienceRelevance: scoreAudienceRelevance({
      storyLocations: item.storyLocation ? [item.storyLocation] : [],
      coverageLanguages:
        item.language === "unknown" ? [] : [item.language],
      primaryCategory: category,
      aiMode: "off",
      aiRating: null,
    }),
  };

  return computeContentabilityScore(assessments);
}

function liveItemToTopic(
  item: RawItem,
  now: Date,
  listLength: number,
): DashboardTopic {
  const category = categorizeTitleByRules(item.titleOriginal);
  const calculated = scoreLiveItem(item, category, now, listLength);
  const firstSeenAt = item.publishedAt ?? item.fetchedAt;
  const ageMinutes = Math.max(
    0,
    Math.round((now.getTime() - Date.parse(firstSeenAt)) / 60_000),
  );
  const metadata = item.sourceMetadata;

  return {
    id: stableTopicId(item),
    titleOriginal: item.titleOriginal,
    titleEnglish: item.titleEnglish,
    language:
      item.language === "unknown"
        ? detectScriptLanguage(item.titleOriginal)
        : item.language,
    category,
    score: calculated.score,
    scoreExact: calculated.scoreExact,
    provisional: calculated.provisional,
    collectingHistory: calculated.collectingHistory,
    scoreBreakdown: calculated.breakdown,
    firstSeenAt,
    ageMinutes: Number.isFinite(ageMinutes) ? ageMinutes : 0,
    markets: item.trendMarket ? [item.trendMarket] : [],
    distinctOutletCount: new Set(
      item.relatedNews.map((evidence) => evidence.source).filter(Boolean),
    ).size,
    sourceName: item.sourceName,
    sourcePosition: item.nativePosition,
    approximateTrafficRaw:
      typeof metadata.approximateTrafficRaw === "string"
        ? metadata.approximateTrafficRaw
        : null,
    evidence: item.relatedNews.map((evidence) => ({ ...evidence })),
    url: item.url,
    riskFlags: [],
    origin: "live",
  };
}

async function readLivePreview(): Promise<DashboardResult> {
  await io();
  const connector = new GoogleTrendsRssConnector(safeFetchClient, "PK");
  const now = new Date();
  const items = await connector.fetch();
  const topics = items
    .map((item) => liveItemToTopic(item, now, items.length))
    .sort((a, b) => b.score - a.score);

  return {
    topics,
    mode: "live-preview",
    fetchedAt: now.toISOString(),
    coverage: ["Google Trends RSS · PK"],
    warning:
      "Live preview is not stored. Start PostgreSQL and the worker to build history, cluster sources, and unlock momentum.",
  };
}

type DashboardDatabase = ReturnType<typeof getDb>;
type StoredTopic = typeof topics.$inferSelect;
type LatestScoreRow = Pick<
  typeof scores.$inferSelect,
  | "topicId"
  | "score"
  | "provisional"
  | "collectingHistory"
  | "breakdown"
>;
type EvidenceRow = {
  topicId: string;
  title: string;
  source: string | null;
  url: string;
  language: string;
};
type StoredRiskFlag = Pick<
  typeof riskFlags.$inferSelect,
  "topicId" | "type" | "severity" | "reason"
>;

function rowsByTopicId<T extends { topicId: string }>(
  rows: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.topicId);
    if (existing) existing.push(row);
    else grouped.set(row.topicId, [row]);
  }
  return grouped;
}

function englishTitle(topic: StoredTopic): string | null {
  return topic.titleEn?.trim() || null;
}

function readabilityPriority(topic: StoredTopic): number {
  if (englishTitle(topic)) return 0;

  const hasDevanagari = DEVANAGARI_SCRIPT_PATTERN.test(topic.titleOriginal);
  const hasArabic = ARABIC_SCRIPT_PATTERN.test(topic.titleOriginal);
  if (!hasDevanagari && !hasArabic) return 0;
  if (hasArabic) return 1;
  return 2;
}

function selectReadableDashboardTopics(candidates: StoredTopic[]): StoredTopic[] {
  return candidates
    .map((topic, recencyIndex) => ({
      topic,
      recencyIndex,
      priority: readabilityPriority(topic),
    }))
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.recencyIndex - right.recencyIndex,
    )
    .slice(0, DASHBOARD_TOPIC_LIMIT)
    .map(({ topic }) => topic);
}

function mapDatabaseTopic(
  topic: StoredTopic,
  latestScore: LatestScoreRow | undefined,
  evidenceRows: EvidenceRow[],
  storedRiskFlags: StoredRiskFlag[],
): DashboardTopic {
  const breakdown = latestScore?.breakdown ?? [];
  const storedLanguage = evidenceRows[0]?.language ?? "unknown";
  const language = supportedLanguages.includes(
    storedLanguage as SupportedLanguage,
  )
    ? (storedLanguage as SupportedLanguage)
    : "unknown";
  const category = categories.includes(topic.primaryCategory as Category)
    ? (topic.primaryCategory as Category)
    : "Other/Unclassified";
  const now = Date.now();
  return {
    id: topic.id,
    titleOriginal: topic.titleOriginal,
    titleEnglish: englishTitle(topic),
    language,
    category,
    score: Math.round(latestScore?.score ?? 0),
    scoreExact: latestScore?.score ?? 0,
    provisional: latestScore?.provisional ?? true,
    collectingHistory: latestScore?.collectingHistory ?? true,
    scoreBreakdown: breakdown,
    firstSeenAt: topic.firstSeenAt.toISOString(),
    ageMinutes: Math.max(0, Math.round((now - topic.firstSeenAt.getTime()) / 60_000)),
    markets: topic.trendMarkets,
    distinctOutletCount: topic.distinctOutletCount,
    sourceName: "Clustered sources",
    sourcePosition: null,
    approximateTrafficRaw: null,
    evidence: evidenceRows.map(({ title, source, url }) => ({
      title,
      source,
      url,
    })),
    url: `/topic/${topic.id}`,
    riskFlags: storedRiskFlags.map(
      (flag) => `${flag.severity} · ${flag.type}: ${flag.reason}`,
    ),
    origin: "live",
  };
}

async function mapDatabaseTopics(
  db: DashboardDatabase,
  storedTopics: StoredTopic[],
): Promise<DashboardTopic[]> {
  if (storedTopics.length === 0) return [];

  const topicIds = storedTopics.map((topic) => topic.id);
  const rankedEvidence = db
    .select({
      topicId: topicItems.topicId,
      title: items.titleOriginal,
      source: items.outletName,
      url: items.url,
      language: items.language,
      evidenceRank:
        sql<number>`row_number() over (partition by ${topicItems.topicId} order by ${topicItems.addedAt} desc)`.as(
          "evidence_rank",
        ),
    })
    .from(topicItems)
    .innerJoin(items, eq(topicItems.itemId, items.id))
    .where(inArray(topicItems.topicId, topicIds))
    .as("ranked_evidence");

  const [latestScores, evidenceRows, storedRiskFlags] = await Promise.all([
    db
      .selectDistinctOn([scores.topicId], {
        topicId: scores.topicId,
        score: scores.score,
        provisional: scores.provisional,
        collectingHistory: scores.collectingHistory,
        breakdown: scores.breakdown,
      })
      .from(scores)
      .where(inArray(scores.topicId, topicIds))
      .orderBy(scores.topicId, desc(scores.computedAt)),
    db
      .select({
        topicId: rankedEvidence.topicId,
        title: rankedEvidence.title,
        source: rankedEvidence.source,
        url: rankedEvidence.url,
        language: rankedEvidence.language,
      })
      .from(rankedEvidence)
      .where(lte(rankedEvidence.evidenceRank, 12))
      .orderBy(rankedEvidence.topicId, rankedEvidence.evidenceRank),
    db
      .select({
        topicId: riskFlags.topicId,
        type: riskFlags.type,
        severity: riskFlags.severity,
        reason: riskFlags.reason,
      })
      .from(riskFlags)
      .where(inArray(riskFlags.topicId, topicIds))
      .orderBy(riskFlags.topicId, desc(riskFlags.createdAt)),
  ]);

  const scoresByTopicId = new Map(
    latestScores.map((score) => [score.topicId, score]),
  );
  const evidenceByTopicId = rowsByTopicId(evidenceRows);
  const riskFlagsByTopicId = rowsByTopicId(storedRiskFlags);

  return storedTopics.map((topic) =>
    mapDatabaseTopic(
      topic,
      scoresByTopicId.get(topic.id),
      evidenceByTopicId.get(topic.id) ?? [],
      riskFlagsByTopicId.get(topic.id) ?? [],
    ),
  );
}

async function readDatabaseTopics(): Promise<DashboardResult> {
  const db = getDb();
  const rows = await db
    .select()
    .from(topics)
    .orderBy(desc(topics.lastActivityAt))
    .limit(DASHBOARD_CANDIDATE_LIMIT);
  const selectedRows = selectReadableDashboardTopics(rows);
  const mapped = await mapDatabaseTopics(db, selectedRows);

  return {
    topics: mapped,
    mode: mapped.length ? "database" : "empty",
    fetchedAt: new Date().toISOString(),
    coverage: ["Persisted source observations"],
    warning: mapped.length ? null : "No ingestion cycle has completed yet.",
  };
}

async function readDatabaseTopic(id: string): Promise<DashboardTopic | null> {
  const db = getDb();
  const [topic] = await db
    .select()
    .from(topics)
    .where(eq(topics.id, id))
    .limit(1);
  if (!topic) return null;
  const [mapped] = await mapDatabaseTopics(db, [topic]);
  return mapped ?? null;
}

export async function getDashboardTopics(): Promise<DashboardResult> {
  await requireSession();

  if (isDatabaseConfigured()) {
    try {
      return await readDatabaseTopics();
    } catch (error) {
      console.error("Database dashboard query failed; using no-key live preview", {
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  try {
    return await readLivePreview();
  } catch (error) {
    return {
      topics: [],
      mode: "empty",
      fetchedAt: null,
      coverage: [],
      warning:
        error instanceof Error
          ? `Live source unavailable: ${error.message}`
          : "Live source unavailable.",
    };
  }
}

export async function getDashboardTopic(
  id: string,
): Promise<DashboardTopic | null> {
  await requireSession();

  if (isDatabaseConfigured() && UUID_PATTERN.test(id)) {
    try {
      const stored = await readDatabaseTopic(id);
      if (stored) return stored;
    } catch (error) {
      console.error("Database topic query failed; checking live preview", {
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const result = await getDashboardTopics();
  return result.topics.find((topic) => topic.id === id) ?? null;
}

