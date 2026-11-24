import type {
  Connector,
  ConnectorCapabilities,
  ConnectorHealth,
  ContentLanguage,
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
  parseDateToIso,
  payloadHash,
  stableId,
  textValue,
} from "./utils";

export const GOOGLE_NEWS_EDITIONS = {
  "en-PK": { hl: "en-PK", gl: "PK", ceid: "PK:en", market: "PK", language: "en" },
  "en-IN": { hl: "en-IN", gl: "IN", ceid: "IN:en", market: "IN", language: "en" },
  "hi-IN": { hl: "hi", gl: "IN", ceid: "IN:hi", market: "IN", language: "hi" },
  "en-US": { hl: "en-US", gl: "US", ceid: "US:en", market: "US", language: "en" },
} as const satisfies Record<
  string,
  {
    hl: string;
    gl: MarketCode;
    ceid: string;
    market: MarketCode;
    language: ContentLanguage;
  }
>;

export type GoogleNewsEditionKey = keyof typeof GOOGLE_NEWS_EDITIONS;

export interface NativeGoogleNewsItem {
  title: string | null;
  link: string | null;
  guid: string | null;
  publishedAt: string | null;
  outlet: string | null;
  outletUrl: string | null;
  description: string | null;
}

function addEdition(url: URL, editionKey: GoogleNewsEditionKey): URL {
  const edition = GOOGLE_NEWS_EDITIONS[editionKey];
  url.searchParams.set("hl", edition.hl);
  url.searchParams.set("gl", edition.gl);
  url.searchParams.set("ceid", edition.ceid);
  return url;
}

export function buildGoogleNewsSearchUrl(
  query: string,
  editionKey: GoogleNewsEditionKey,
): string {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) throw new Error("Google News query must not be empty");
  const url = addEdition(new URL("https://news.google.com/rss/search"), editionKey);
  url.searchParams.set("q", normalizedQuery);
  return url.toString();
}

export function buildGoogleNewsTopStoriesUrl(editionKey: GoogleNewsEditionKey): string {
  return addEdition(new URL("https://news.google.com/rss"), editionKey).toString();
}

export function parseGoogleNewsXml(xml: string): readonly NativeGoogleNewsItem[] {
  const parsed = asRecord(feedXmlParser.parse(xml));
  const rss = asRecord(parsed?.rss);
  const channel = asRecord(rss?.channel);

  return asArray(channel?.item).map((value) => {
    const item = asRecord(value) ?? {};
    const source = asRecord(item.source);
    return {
      title: textValue(item.title),
      link: textValue(item.link),
      guid: textValue(item.guid),
      publishedAt: parseDateToIso(item.pubDate),
      outlet: textValue(item.source),
      outletUrl: textValue(source?.["@url"]),
      description: textValue(item.description),
    };
  });
}

function withoutOutletSuffix(title: string, outlet: string | null): string {
  if (!outlet) return title;
  const suffix = ` - ${outlet}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

export class GoogleNewsRssConnector implements Connector<NativeGoogleNewsItem> {
  private readonly tracker = new HealthTracker();
  private readonly sourceUrl: string;
  private readonly query: string | null;

  constructor(
    private readonly client: FetchClient,
    private readonly editionKey: GoogleNewsEditionKey,
    query?: string,
  ) {
    this.query = query?.trim() || null;
    this.sourceUrl = this.query
      ? buildGoogleNewsSearchUrl(this.query, editionKey)
      : buildGoogleNewsTopStoriesUrl(editionKey);
  }

  capabilities(): ConnectorCapabilities {
    return {
      id: "google-news-rss",
      label: "Google News RSS",
      phase: "free",
      access: "public-undocumented",
      flag: "SRC_GNEWS_RSS",
      supportedMarkets: ["PK", "IN", "US"],
      languageSemantics:
        "Language is the requested edition language. Urdu-Pakistan is not offered because the live edition falls back to English.",
      reportingWindow: null,
      metricDefinitions: {
        feed_position:
          "Provider feed order for the requested edition/search; not a volume or popularity metric.",
      },
      minimumRefreshIntervalMs: 30 * 60 * 1_000,
      credentials: "none",
      retention: { rawPayloadDays: 7, normalizedItemDays: 90 },
      sourceUrl: "https://news.google.com/rss",
      verifiedOn: "2026-11-23",
    };
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
      const items = parseGoogleNewsXml(response.body)
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

  normalize(item: NativeGoogleNewsItem, context: NormalizeContext): RawItem | null {
    const rawTitle = item.title?.trim();
    const url = item.link?.trim();
    if (!rawTitle || !url) return null;
    const edition = GOOGLE_NEWS_EDITIONS[this.editionKey];
    const title = withoutOutletSuffix(rawTitle, item.outlet);

    return {
      connector: "google-news-rss",
      externalId: item.guid ?? stableId(this.editionKey, url, item.publishedAt),
      sourceName: item.outlet ?? "Google News",
      url,
      titleOriginal: title,
      titleEnglish: edition.language === "en" ? title : null,
      summaryOriginal: null,
      publishedAt: item.publishedAt,
      fetchedAt: context.fetchedAt,
      trendMarket: edition.market,
      publisherCountry: null,
      storyLocation: null,
      targetAudienceLanguages: [edition.language],
      language: edition.language,
      languageDetectionMethod: "provider-metadata",
      nativePosition: context.itemIndex + 1,
      nativeMetricName: null,
      nativeMetricValue: null,
      nativeMetricUnit: null,
      reportingWindow: this.query?.includes("when:1d")
        ? "1d (Google News query operator)"
        : null,
      origin: "live",
      relatedNews: [],
      sourceMetadata: {
        outlet: item.outlet,
        outletUrl: item.outletUrl,
        edition: this.editionKey,
        query: this.query,
        feedTitleRaw: rawTitle,
        feedPosition: context.itemIndex + 1,
        feedPositionMeaning: "provider feed order; not a volume rank",
        usageNotice:
          "Google News RSS is undocumented and intended for personal feed-reader use.",
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
