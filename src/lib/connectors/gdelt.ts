import type {
  Connector,
  ConnectorCapabilities,
  ConnectorHealth,
  ContentLanguage,
  FetchClient,
  NormalizeContext,
  RawItem,
} from "./types";
import { FREE_UNMETERED_COST, type QuotaCost } from "./types";
import {
  asRecord,
  fetchedAtIso,
  HealthTracker,
  payloadHash,
  stableId,
  textValue,
} from "./utils";

export const GDELT_DISCOVERY_QUERIES = {
  pakistan: { query: "sourcecountry:Pakistan", market: "PK" },
  india: { query: "sourcecountry:India", market: "IN" },
  urdu: { query: "sourcelang:urdu", market: "WORLD" },
  hindi: { query: "sourcelang:hindi", market: "WORLD" },
} as const;

export type GdeltDiscoveryKey = keyof typeof GDELT_DISCOVERY_QUERIES;

export interface NativeGdeltArticle {
  url: string | null;
  title: string | null;
  seenAt: string | null;
  domain: string | null;
  language: string | null;
  sourceCountry: string | null;
  imageUrl: string | null;
}

export function buildGdeltDocUrl(key: GdeltDiscoveryKey): string {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", GDELT_DISCOVERY_QUERIES[key].query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", "250");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", "1h");
  url.searchParams.set("sort", "datedesc");
  return url.toString();
}

function parseGdeltDate(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(raw);
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseGdeltDocJson(body: string): readonly NativeGdeltArticle[] {
  const payload = asRecord(JSON.parse(body));
  const articles = Array.isArray(payload?.articles) ? payload.articles : [];
  return articles.map((value) => {
    const article = asRecord(value) ?? {};
    return {
      url: textValue(article.url),
      title: textValue(article.title),
      seenAt: parseGdeltDate(article.seendate),
      domain: textValue(article.domain),
      language: textValue(article.language),
      sourceCountry: textValue(article.sourcecountry),
      imageUrl: textValue(article.socialimage),
    };
  });
}

function contentLanguage(value: string | null): ContentLanguage {
  switch (value?.trim().toLowerCase()) {
    case "english": return "en";
    case "urdu": return "ur";
    case "hindi": return "hi";
    default: return "unknown";
  }
}

export class GdeltDocConnector implements Connector<NativeGdeltArticle> {
  private readonly tracker = new HealthTracker();
  private readonly sourceUrl: string;

  constructor(
    private readonly client: FetchClient,
    private readonly discoveryKey: GdeltDiscoveryKey,
  ) {
    this.sourceUrl = buildGdeltDocUrl(discoveryKey);
  }

  capabilities(): ConnectorCapabilities {
    return {
      id: "gdelt-doc",
      label: "GDELT DOC 2.0",
      phase: "free",
      access: "provider-published",
      flag: "SRC_GDELT",
      supportedMarkets: ["PK", "IN", "WORLD"],
      languageSemantics: "Language and source country are provider metadata; neither proves the story location or audience market.",
      reportingWindow: "Articles observed by GDELT in the requested one-hour discovery window.",
      metricDefinitions: {},
      minimumRefreshIntervalMs: 15 * 60 * 1_000,
      credentials: "none",
      retention: { rawPayloadDays: 7, normalizedItemDays: 90 },
      sourceUrl: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
      verifiedOn: "2026-11-24",
    };
  }

  health(): ConnectorHealth { return this.tracker.read(); }
  quotaCost(): QuotaCost { return FREE_UNMETERED_COST; }

  async fetch(): Promise<RawItem[]> {
    this.tracker.attempt();
    let status: number | null = null;
    try {
      const response = await this.client.fetch(this.sourceUrl, {
        headers: { Accept: "application/json" },
        timeoutMs: 20_000,
        maxBytes: 5 * 1_024 * 1_024,
        acceptedContentTypes: ["application/json"],
      });
      status = response.status;
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`GDELT returned HTTP ${response.status}`);
      }
      const fetchedAt = fetchedAtIso(response);
      const items = parseGdeltDocJson(response.body)
        .map((item, itemIndex) => this.normalize(item, { sourceUrl: response.url, itemIndex, fetchedAt }))
        .filter((item): item is RawItem => item !== null);
      this.tracker.success(response.status, items.length, new Date(fetchedAt));
      return items;
    } catch (error) {
      this.tracker.failure(error, status);
      throw error;
    }
  }

  normalize(item: NativeGdeltArticle, context: NormalizeContext): RawItem | null {
    const title = item.title?.trim();
    const url = item.url?.trim();
    if (!title || !url) return null;
    const query = GDELT_DISCOVERY_QUERIES[this.discoveryKey];
    const language = contentLanguage(item.language);
    return {
      connector: "gdelt-doc",
      externalId: stableId(url),
      sourceName: item.domain ?? "GDELT-discovered outlet",
      url,
      titleOriginal: title,
      titleEnglish: language === "en" ? title : null,
      summaryOriginal: null,
      publishedAt: item.seenAt,
      fetchedAt: context.fetchedAt,
      trendMarket: query.market,
      publisherCountry: item.sourceCountry,
      storyLocation: null,
      targetAudienceLanguages: language === "unknown" ? [] : [language],
      language,
      languageDetectionMethod: item.language ? "provider-metadata" : "unknown",
      nativePosition: null,
      nativeMetricName: null,
      nativeMetricValue: null,
      nativeMetricUnit: null,
      reportingWindow: "1h",
      origin: "live",
      relatedNews: [],
      sourceMetadata: {
        discoveryQuery: query.query,
        imageUrl: item.imageUrl,
        attribution: "Data: The GDELT Project",
        coverageMeaning: "Article discovery, not audience popularity or verification",
      },
      rawRef: {
        sourceUrl: context.sourceUrl,
        itemIndex: context.itemIndex,
        payloadHash: payloadHash(item),
        fetchedAt: context.fetchedAt,
      },
    };
  }
}
