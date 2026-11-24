import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TEST_ONLY_GOOGLE_NEWS_XML,
  TEST_ONLY_GOOGLE_TRENDS_XML,
  TEST_ONLY_PUBLISHER_ATOM_XML,
  TEST_ONLY_PUBLISHER_RSS_XML,
} from "./__fixtures__/test-only-feeds";
import { loadFeedRegistry, parseFeedRegistry } from "./feed-registry";
import {
  buildGdeltDocUrl,
  GdeltDocConnector,
  parseGdeltDocJson,
} from "./gdelt";
import {
  buildGoogleNewsSearchUrl,
  GOOGLE_NEWS_EDITIONS,
  GoogleNewsRssConnector,
  parseGoogleNewsXml,
} from "./google-news";
import {
  buildGoogleTrendsRssUrl,
  GoogleTrendsRssConnector,
  parseGoogleTrendsXml,
} from "./google-trends";
import { parsePublisherFeedXml, PublisherRssConnector } from "./publisher-rss";
import type { FetchClient, FetchClientResponse } from "./types";

class TestOnlyFetchClient implements FetchClient {
  public lastUrl: string | null = null;
  public lastOptions: Parameters<FetchClient["fetch"]>[1] = undefined;

  constructor(private readonly response: FetchClientResponse) {}

  async fetch(
    url: string,
    options?: Parameters<FetchClient["fetch"]>[1],
  ): Promise<FetchClientResponse> {
    this.lastUrl = url;
    this.lastOptions = options;
    return this.response;
  }
}

const fetchedAt = "2026-11-23T09:00:00.000Z";

const TEST_ONLY_GDELT_JSON = JSON.stringify({
  articles: [{
    url: "https://example.test/pakistan/story",
    title: "پاکستان میں اہم خبر",
    seendate: "20261124T120000Z",
    domain: "example.test",
    language: "Urdu",
    sourcecountry: "Pakistan",
    socialimage: "https://example.test/image.jpg",
  }],
});

describe("GDELT DOC connector", () => {
  it("uses documented article-list parameters and preserves provenance", async () => {
    const url = new URL(buildGdeltDocUrl("pakistan"));
    expect(url.searchParams.get("query")).toBe("sourcecountry:Pakistan");
    expect(url.searchParams.get("maxrecords")).toBe("250");
    expect(url.searchParams.get("mode")).toBe("artlist");

    const connector = new GdeltDocConnector(new TestOnlyFetchClient({
      url: url.toString(),
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      body: TEST_ONLY_GDELT_JSON,
      fetchedAt,
    }), "pakistan");
    const [item] = await connector.fetch();

    expect(parseGdeltDocJson(TEST_ONLY_GDELT_JSON)).toHaveLength(1);
    expect(item).toMatchObject({
      connector: "gdelt-doc",
      language: "ur",
      publisherCountry: "Pakistan",
      trendMarket: "PK",
      publishedAt: "2026-11-24T12:00:00.000Z",
      nativeMetricValue: null,
    });
    expect(item?.sourceMetadata.attribution).toBe("Data: The GDELT Project");
  });

  it("keeps malformed provider dates missing", () => {
    const [article] = parseGdeltDocJson(TEST_ONLY_GDELT_JSON.replace("20261124T120000Z", "unknown"));
    expect(article?.seenAt).toBeNull();
  });
});

describe("Google Trends RSS connector", () => {
  it("parses provider metrics without treating feed position as a volume rank", async () => {
    const client = new TestOnlyFetchClient({
      url: buildGoogleTrendsRssUrl("PK"),
      status: 200,
      headers: new Headers({ "content-type": "application/rss+xml" }),
      body: TEST_ONLY_GOOGLE_TRENDS_XML,
      fetchedAt,
    });
    const connector = new GoogleTrendsRssConnector(client, "PK");

    const items = await connector.fetch();

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      connector: "google-trends-rss",
      externalId: "pk-psl-2026",
      titleOriginal: "پاکستان سپر لیگ",
      trendMarket: "PK",
      publisherCountry: null,
      language: "unknown",
      nativePosition: 1,
      nativeMetricName: "approx_traffic_lower_bound",
      nativeMetricValue: 2_000,
      nativeMetricUnit: "searches",
      origin: "live",
    });
    expect(items[0]?.sourceMetadata.approximateTrafficRaw).toBe("2,000+");
    expect(items[0]?.sourceMetadata.feedPositionMeaning).toContain("not a volume rank");
    expect(items[0]?.relatedNews).toHaveLength(2);
    expect(connector.health()).toMatchObject({ status: "healthy", itemsLastRun: 2 });
    expect(connector.quotaCost()).toEqual({ kind: "unmetered", units: 0, estimatedUsd: 0 });
  });

  it("keeps malformed or missing traffic as null rather than inventing zero", () => {
    const parsed = parseGoogleTrendsXml(
      TEST_ONLY_GOOGLE_TRENDS_XML.replace("500+", "unknown"),
    );
    const connector = new GoogleTrendsRssConnector(
      new TestOnlyFetchClient({
        url: "https://trends.google.com/trending/rss?geo=PK",
        status: 200,
        headers: {},
        body: "",
        fetchedAt,
      }),
      "PK",
    );
    const normalized = connector.normalize(parsed[1]!, {
      sourceUrl: "https://trends.google.com/trending/rss?geo=PK",
      itemIndex: 1,
      fetchedAt,
    });
    expect(normalized?.nativeMetricName).toBeNull();
    expect(normalized?.nativeMetricValue).toBeNull();
  });
});

describe("Google News RSS connector", () => {
  it("offers only editions verified not to fall back to another language", () => {
    expect(Object.keys(GOOGLE_NEWS_EDITIONS)).toEqual(["en-PK", "en-IN", "hi-IN", "en-US"]);
    expect(Object.keys(GOOGLE_NEWS_EDITIONS)).not.toContain("ur-PK");
  });

  it("builds an encoded search URL with all locale fields", () => {
    const url = new URL(buildGoogleNewsSearchUrl('"viral video" when:1d', "hi-IN"));
    expect(url.origin + url.pathname).toBe("https://news.google.com/rss/search");
    expect(url.searchParams.get("q")).toBe('"viral video" when:1d');
    expect(url.searchParams.get("hl")).toBe("hi");
    expect(url.searchParams.get("gl")).toBe("IN");
    expect(url.searchParams.get("ceid")).toBe("IN:hi");
  });

  it("preserves market, language, outlet, and feed-order semantics", async () => {
    const responseUrl = buildGoogleNewsSearchUrl("science when:1d", "en-PK");
    const connector = new GoogleNewsRssConnector(
      new TestOnlyFetchClient({
        url: responseUrl,
        status: 200,
        headers: { "content-type": "application/rss+xml" },
        body: TEST_ONLY_GOOGLE_NEWS_XML,
        fetchedAt,
      }),
      "en-PK",
      "science when:1d",
    );

    const [item] = await connector.fetch();

    expect(parseGoogleNewsXml(TEST_ONLY_GOOGLE_NEWS_XML)).toHaveLength(1);
    expect(item).toMatchObject({
      titleOriginal: "Major science mission launches",
      sourceName: "Example Daily",
      trendMarket: "PK",
      publisherCountry: null,
      language: "en",
      nativePosition: 1,
      nativeMetricName: null,
      nativeMetricValue: null,
      reportingWindow: "1d (Google News query operator)",
    });
    expect(item?.sourceMetadata.feedPositionMeaning).toContain("not a volume rank");
  });
});

describe("publisher RSS connector and registry", () => {
  it("loads the checked-in verified registry with unique HTTPS feeds", async () => {
    const registry = await loadFeedRegistry(
      join(process.cwd(), "config", "feeds.yaml"),
    );
    expect(registry.feeds.length).toBeGreaterThanOrEqual(7);
    expect(new Set(registry.feeds.map((feed) => feed.id)).size).toBe(registry.feeds.length);
    expect(registry.feeds.every((feed) => feed.url.startsWith("https://"))).toBe(true);
    expect(registry.feeds.find((feed) => feed.id === "bbc-urdu")?.language).toBe("ur");
  });

  it("rejects duplicate registry identities", () => {
    const yaml = `version: 1
feeds:
  - id: duplicate
    name: Example
    url: https://example.test/rss
    country: PK
    language: en
    type: general
    tier: 1
    refreshMinutes: 15
    verifiedOn: 2026-11-23
    enabled: true
  - id: duplicate
    name: Example Two
    url: https://example.test/rss-two
    country: GB
    language: en
    type: general
    tier: 2
    refreshMinutes: 60
    verifiedOn: 2026-11-23
    enabled: true
`;
    expect(() => parseFeedRegistry(yaml)).toThrow(/Duplicate feed/);
  });

  it("normalizes RSS and Atom while stripping markup and keeping summaries short", async () => {
    const registryYaml = await readFile(join(process.cwd(), "config", "feeds.yaml"), "utf8");
    const feed = parseFeedRegistry(registryYaml).feeds[0]!;
    const connector = new PublisherRssConnector(
      new TestOnlyFetchClient({
        url: feed.url,
        status: 200,
        headers: new Headers({ "content-type": "application/rss+xml" }),
        body: TEST_ONLY_PUBLISHER_RSS_XML,
        fetchedAt,
      }),
      feed,
    );

    const [rssItem] = await connector.fetch();
    const [atomItem] = parsePublisherFeedXml(TEST_ONLY_PUBLISHER_ATOM_XML);

    expect(rssItem).toMatchObject({
      connector: "publisher-rss",
      sourceName: "Dawn",
      publisherCountry: "PK",
      trendMarket: null,
      language: "en",
      titleOriginal: "Detailed headline from Pakistan",
      summaryOriginal: "A short summary & useful context.",
      nativeMetricName: null,
      nativeMetricValue: null,
    });
    expect(rssItem?.sourceMetadata.imageUrl).toBe("https://example.test/image.jpg");
    expect(rssItem?.summaryOriginal).not.toContain("script");
    expect(atomItem).toMatchObject({
      title: "Atom headline",
      link: "https://example.test/news/story-2",
      summary: "Atom summary.",
      author: "Atom Reporter",
    });
  });
});
