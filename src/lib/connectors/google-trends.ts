import type {
  Connector,
  ConnectorCapabilities,
  ConnectorHealth,
  FetchClient,
  MarketCode,
  NormalizeContext,
  RawItem,
} from "./types";
import { FREE_UNMETERED_COST, type QuotaCost } from "./types";
import {
  asArray,
  asRecord,
  assertSuccessfulFeedResponse,
  feedXmlParser,
  fetchedAtIso,
  HealthTracker,
  parseApproximateLowerBound,
  parseDateToIso,
  payloadHash,
  stableId,
  textValue,
} from "./utils";

export const GOOGLE_TRENDS_MARKETS = ["PK", "IN", "US", "GB", "AE", "SA"] as const;
export type GoogleTrendsMarket = (typeof GOOGLE_TRENDS_MARKETS)[number];

interface NativeTrendsNewsItem {
  title: string | null;
  url: string | null;
  source: string | null;
}

export interface NativeGoogleTrendItem {
  title: string | null;
  link: string | null;
  guid: string | null;
  publishedAt: string | null;
  approximateTrafficRaw: string | null;
  pictureUrl: string | null;
  newsItems: readonly NativeTrendsNewsItem[];
}

export function buildGoogleTrendsRssUrl(market: GoogleTrendsMarket): string {
  const url = new URL("https://trends.google.com/trending/rss");
  url.searchParams.set("geo", market);
  return url.toString();
}

function parseNewsItem(value: unknown): NativeTrendsNewsItem {
  const record = asRecord(value) ?? {};
  return {
    title: textValue(record["ht:news_item_title"]),
    url: textValue(record["ht:news_item_url"]),
    source: textValue(record["ht:news_item_source"]),
  };
}

export function parseGoogleTrendsXml(xml: string): readonly NativeGoogleTrendItem[] {
  const parsed = asRecord(feedXmlParser.parse(xml));
  const rss = asRecord(parsed?.rss);
  const channel = asRecord(rss?.channel);

  return asArray(channel?.item).map((value) => {
    const item = asRecord(value) ?? {};
    return {
      title: textValue(item.title),
      link: textValue(item.link),
      guid: textValue(item.guid),
      publishedAt: parseDateToIso(item.pubDate),
      approximateTrafficRaw: textValue(item["ht:approx_traffic"]),
      pictureUrl: textValue(item["ht:picture"]),
      newsItems: asArray(item["ht:news_item"]).slice(0, 3).map(parseNewsItem),
    };
  });
}

const CAPABILITY_BASE = {
  id: "google-trends-rss",
  label: "Google Trends — Trending now RSS",
  phase: "free",
  access: "public-undocumented",
  flag: "SRC_GTRENDS_RSS",
  supportedMarkets: GOOGLE_TRENDS_MARKETS,
  languageSemantics:
    "Titles use the language returned by the feed; language is not inferred from geo.",
  reportingWindow: "Provider-defined current trending window; no historical API is exposed.",
  metricDefinitions: {
    approx_traffic_lower_bound:
      "Parsed lower bound from ht:approx_traffic. The raw provider string is preserved.",
    feed_position:
      "Newest-first feed position. It is not a rank by search volume.",
  },
  minimumRefreshIntervalMs: 30 * 60 * 1_000,
  credentials: "none",
  retention: { rawPayloadDays: 7, normalizedItemDays: 90 },
  sourceUrl: "https://support.google.com/trends/answer/3076011",
  verifiedOn: "2026-11-23",
} as const satisfies Omit<ConnectorCapabilities, "supportedMarkets"> & {
  supportedMarkets: readonly MarketCode[];
};

export class GoogleTrendsRssConnector implements Connector<NativeGoogleTrendItem> {
  private readonly tracker = new HealthTracker();
  private readonly sourceUrl: string;

  constructor(
    private readonly client: FetchClient,
    private readonly market: GoogleTrendsMarket,
  ) {
    this.sourceUrl = buildGoogleTrendsRssUrl(market);
  }

  capabilities(): ConnectorCapabilities {
    return CAPABILITY_BASE;
  }

  health(): ConnectorHealth {
    return this.tracker.read();
  }

  quotaCost(): QuotaCost {
    return FREE_UNMETERED_COST;
  }

  async fetch(): Promise<RawItem[]> {
    this.tracker.attempt();
    let status: number | null = null;

    try {
      const response = await this.client.fetch(this.sourceUrl, {
        headers: { Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8" },
        timeoutMs: 20_000,
        maxBytes: 5 * 1_024 * 1_024,
        acceptedContentTypes: ["application/rss+xml", "application/xml", "text/xml"],
      });
      status = response.status;
      assertSuccessfulFeedResponse(response);
      const fetchedAt = fetchedAtIso(response);
      const items = parseGoogleTrendsXml(response.body)
        .map((item, itemIndex) =>
          this.normalize(item, { sourceUrl: response.url, itemIndex, fetchedAt }),
        )
        .filter((item): item is RawItem => item !== null);
      this.tracker.success(response.status, items.length, new Date(fetchedAt));
      return items;
    } catch (error) {
      this.tracker.failure(error, status);
      throw error;
    }
  }

  normalize(item: NativeGoogleTrendItem, context: NormalizeContext): RawItem | null {
    const title = item.title?.trim();
    if (!title) return null;

    const publishedAt = item.publishedAt;
    const externalId = item.guid ?? stableId(this.market, title, publishedAt);
    const approximateTrafficLowerBound = parseApproximateLowerBound(
      item.approximateTrafficRaw,
    );

    return {
      connector: "google-trends-rss",
      externalId,
      sourceName: "Google Trends",
      url: item.link ?? `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}`,
      titleOriginal: title,
      titleEnglish: null,
      summaryOriginal: null,
      publishedAt,
      fetchedAt: context.fetchedAt,
      trendMarket: this.market,
      publisherCountry: null,
      storyLocation: null,
      targetAudienceLanguages: [],
      language: "unknown",
      languageDetectionMethod: "unknown",
      nativePosition: context.itemIndex + 1,
      nativeMetricName:
        approximateTrafficLowerBound === null ? null : "approx_traffic_lower_bound",
      nativeMetricValue: approximateTrafficLowerBound,
      nativeMetricUnit: approximateTrafficLowerBound === null ? null : "searches",
      reportingWindow: CAPABILITY_BASE.reportingWindow,
      origin: "live",
      relatedNews: item.newsItems
        .filter(
          (news): news is NativeTrendsNewsItem & { title: string; url: string } =>
            Boolean(news.title && news.url),
        )
        .slice(0, 3)
        .map((news) => ({ title: news.title, url: news.url, source: news.source })),
      sourceMetadata: {
        approximateTrafficRaw: item.approximateTrafficRaw,
        approximateTrafficLowerBound,
        pictureUrl: item.pictureUrl,
        feedPosition: context.itemIndex + 1,
        feedPositionMeaning: "newest-first provider order; not a volume rank",
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
