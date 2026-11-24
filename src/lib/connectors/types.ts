export type ConnectorId =
  | "google-trends-rss"
  | "google-news-rss"
  | "publisher-rss"
  | "gdelt-doc";

export type MarketCode = "PK" | "IN" | "US" | "GB" | "AE" | "SA" | "WORLD";

export type ContentLanguage =
  | "en"
  | "ur"
  | "ur-Latn"
  | "hi"
  | "hi-Latn"
  | "other"
  | "unknown";

export type ConnectorStatus = "idle" | "healthy" | "stale" | "error" | "disabled";

export interface ConnectorCapabilities {
  id: ConnectorId;
  label: string;
  phase: "free";
  access: "public-undocumented" | "provider-published";
  flag: "SRC_GTRENDS_RSS" | "SRC_GNEWS_RSS" | "SRC_RSS" | "SRC_GDELT";
  supportedMarkets: readonly MarketCode[];
  languageSemantics: string;
  reportingWindow: string | null;
  metricDefinitions: Readonly<Record<string, string>>;
  minimumRefreshIntervalMs: number;
  credentials: "none";
  retention: Readonly<{
    rawPayloadDays: number;
    normalizedItemDays: number;
  }>;
  sourceUrl: string;
  verifiedOn: string;
}

export interface ConnectorHealth {
  status: ConnectorStatus;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  lastHttpStatus: number | null;
  itemsLastRun: number | null;
}

export interface QuotaCost {
  kind: "unmetered";
  units: 0;
  estimatedUsd: 0;
}

export interface FetchClientOptions {
  headers?: Readonly<Record<string, string>>;
  timeoutMs?: number;
  maxBytes?: number;
  acceptedContentTypes?: readonly string[];
}

export interface FetchClientResponse {
  url: string;
  status: number;
  headers: Headers | Readonly<Record<string, string>>;
  body: string;
  fetchedAt: Date | string;
}

/**
 * The HTTP implementation is injected so connectors can use the central
 * SSRF-safe fetcher in production and a deterministic client in tests.
 */
export interface FetchClient {
  fetch(url: string, options?: FetchClientOptions): Promise<FetchClientResponse>;
}

export interface RawReference {
  sourceUrl: string;
  itemIndex: number;
  payloadHash: string;
  fetchedAt: string;
}

export interface RelatedNewsItem {
  title: string;
  url: string;
  source: string | null;
}

export interface RawItem {
  connector: ConnectorId;
  externalId: string;
  sourceName: string;
  url: string;
  titleOriginal: string;
  titleEnglish: string | null;
  summaryOriginal: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  trendMarket: MarketCode | null;
  publisherCountry: string | null;
  storyLocation: string | null;
  targetAudienceLanguages: readonly ContentLanguage[];
  language: ContentLanguage;
  languageDetectionMethod: "provider-metadata" | "feed-registry" | "unknown";
  nativePosition: number | null;
  nativeMetricName: string | null;
  nativeMetricValue: number | null;
  nativeMetricUnit: string | null;
  reportingWindow: string | null;
  origin: "live";
  relatedNews: readonly RelatedNewsItem[];
  sourceMetadata: Readonly<Record<string, unknown>>;
  rawRef: RawReference;
}

export interface NormalizeContext {
  sourceUrl: string;
  itemIndex: number;
  fetchedAt: string;
}

export interface Connector<TNativeItem = unknown> {
  capabilities(): ConnectorCapabilities;
  fetch(): Promise<RawItem[]>;
  normalize(item: TNativeItem, context: NormalizeContext): RawItem | null;
  health(): ConnectorHealth;
  quotaCost(): QuotaCost;
}

export const FREE_UNMETERED_COST: QuotaCost = Object.freeze({
  kind: "unmetered",
  units: 0,
  estimatedUsd: 0,
});
