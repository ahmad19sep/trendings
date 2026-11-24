import type { PublisherFeedDefinition } from "./feed-registry";
import type {
  Connector,
  ConnectorCapabilities,
  ConnectorHealth,
  FetchClient,
  NormalizeContext,
  RawItem,
} from "./types";
import { FREE_UNMETERED_COST, type QuotaCost } from "./types";
import {
  asArray,
  asRecord,
  assertSuccessfulFeedResponse,
  attributeValue,
  feedXmlParser,
  fetchedAtIso,
  HealthTracker,
  parseDateToIso,
  payloadHash,
  stableId,
  stripMarkup,
  textValue,
} from "./utils";

export interface NativePublisherFeedItem {
  id: string | null;
  title: string | null;
  link: string | null;
  summary: string | null;
  publishedAt: string | null;
  author: string | null;
  imageUrl: string | null;
}

function firstText(...values: readonly unknown[]): string | null {
  for (const value of values) {
    const text = textValue(value);
    if (text) return text;
  }
  return null;
}

function rssLink(value: unknown): string | null {
  return firstText(value, attributeValue(value, "href"));
}

function atomLink(value: unknown): string | null {
  const links = asArray(value);
  const alternate = links.find((candidate) => {
    const rel = attributeValue(candidate, "rel");
    return rel === null || rel === "alternate";
  });
  return attributeValue(alternate ?? links[0], "href") ?? textValue(alternate ?? links[0]);
}

function imageFromEntry(entry: Record<string, unknown>): string | null {
  const mediaContent = asArray(entry["media:content"])[0];
  const mediaThumbnail = asArray(entry["media:thumbnail"])[0];
  const enclosure = asArray(entry.enclosure).find((candidate) => {
    const type = attributeValue(candidate, "type");
    return type?.startsWith("image/") ?? true;
  });
  return (
    attributeValue(mediaContent, "url") ??
    attributeValue(mediaThumbnail, "url") ??
    attributeValue(enclosure, "url")
  );
}

function parseRssEntries(channel: Record<string, unknown>): readonly NativePublisherFeedItem[] {
  return asArray(channel.item).map((value) => {
    const entry = asRecord(value) ?? {};
    return {
      id: firstText(entry.guid, entry.id),
      title: textValue(entry.title),
      link: rssLink(entry.link),
      summary: stripMarkup(
        entry.description ?? entry.summary ?? entry["content:encoded"] ?? entry.content,
      ),
      publishedAt: parseDateToIso(entry.pubDate ?? entry.published ?? entry.updated),
      author: firstText(entry.author, entry["dc:creator"]),
      imageUrl: imageFromEntry(entry),
    };
  });
}

function parseAtomEntries(feed: Record<string, unknown>): readonly NativePublisherFeedItem[] {
  return asArray(feed.entry).map((value) => {
    const entry = asRecord(value) ?? {};
    const author = asRecord(entry.author);
    return {
      id: firstText(entry.id, entry.guid),
      title: textValue(entry.title),
      link: atomLink(entry.link),
      summary: stripMarkup(entry.summary ?? entry.content),
      publishedAt: parseDateToIso(entry.published ?? entry.updated),
      author: firstText(author?.name, entry.author),
      imageUrl: imageFromEntry(entry),
    };
  });
}

export function parsePublisherFeedXml(xml: string): readonly NativePublisherFeedItem[] {
  const parsed = asRecord(feedXmlParser.parse(xml));
  const rss = asRecord(parsed?.rss);
  const channel = asRecord(rss?.channel);
  if (channel) return parseRssEntries(channel);

  const feed = asRecord(parsed?.feed);
  if (feed) return parseAtomEntries(feed);

  return [];
}

export class PublisherRssConnector implements Connector<NativePublisherFeedItem> {
  private readonly tracker = new HealthTracker();

  constructor(
    private readonly client: FetchClient,
    private readonly feed: PublisherFeedDefinition,
  ) {}

  capabilities(): ConnectorCapabilities {
    return {
      id: "publisher-rss",
      label: `${this.feed.name} RSS`,
      phase: "free",
      access: "provider-published",
      flag: "SRC_RSS",
      supportedMarkets: [],
      languageSemantics:
        "Language comes from the verified feed registry and remains independent from publisher country.",
      reportingWindow: "Publisher-defined rolling feed window.",
      metricDefinitions: {
        feed_position: "Provider feed order, usually newest-first; not a popularity rank.",
      },
      minimumRefreshIntervalMs: this.feed.refreshMinutes * 60 * 1_000,
      credentials: "none",
      retention: { rawPayloadDays: 7, normalizedItemDays: 90 },
      sourceUrl: this.feed.url,
      verifiedOn: this.feed.verifiedOn,
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
      const response = await this.client.fetch(this.feed.url, {
        headers: {
          Accept:
            "application/rss+xml, application/atom+xml;q=0.9, application/xml;q=0.8, text/xml;q=0.7",
        },
        timeoutMs: 20_000,
        maxBytes: 5 * 1_024 * 1_024,
        acceptedContentTypes: [
          "application/rss+xml",
          "application/atom+xml",
          "application/xml",
          "text/xml",
        ],
      });
      status = response.status;
      assertSuccessfulFeedResponse(response);
      const fetchedAt = fetchedAtIso(response);
      const items = parsePublisherFeedXml(response.body)
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

  normalize(item: NativePublisherFeedItem, context: NormalizeContext): RawItem | null {
    const title = item.title?.trim();
    const url = item.link?.trim();
    if (!title || !url) return null;

    return {
      connector: "publisher-rss",
      externalId: item.id ?? stableId(this.feed.id, url, item.publishedAt),
      sourceName: this.feed.name,
      url,
      titleOriginal: title,
      titleEnglish: this.feed.language === "en" ? title : null,
      summaryOriginal: item.summary,
      publishedAt: item.publishedAt,
      fetchedAt: context.fetchedAt,
      trendMarket: null,
      publisherCountry: this.feed.country,
      storyLocation: null,
      targetAudienceLanguages: [],
      language: this.feed.language,
      languageDetectionMethod: "feed-registry",
      nativePosition: context.itemIndex + 1,
      nativeMetricName: null,
      nativeMetricValue: null,
      nativeMetricUnit: null,
      reportingWindow: "Publisher-defined rolling feed window",
      origin: "live",
      relatedNews: [],
      sourceMetadata: {
        feedId: this.feed.id,
        feedType: this.feed.type,
        feedTier: this.feed.tier,
        author: item.author,
        imageUrl: item.imageUrl,
        feedPosition: context.itemIndex + 1,
        feedPositionMeaning: "provider feed order; not a popularity rank",
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
