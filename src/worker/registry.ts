import {
  GOOGLE_NEWS_EDITIONS,
  GOOGLE_TRENDS_MARKETS,
  GoogleNewsRssConnector,
  GoogleTrendsRssConnector,
  GDELT_DISCOVERY_QUERIES,
  GdeltDocConnector,
  loadFeedRegistry,
  PublisherRssConnector,
  type Connector,
  type FetchClient,
} from "../lib/connectors";

import { queueNames, type IngestionQueueName } from "./schedules";

export const IMPLEMENTED_SOURCE_FLAGS = [
  "SRC_GTRENDS_RSS",
  "SRC_GNEWS_RSS",
  "SRC_RSS",
  "SRC_GDELT",
] as const;

export type ImplementedSourceFlag = (typeof IMPLEMENTED_SOURCE_FLAGS)[number];
type SourceEnvironment = Readonly<Record<string, string | undefined>>;

const sourceFlagDefaults: Readonly<Record<ImplementedSourceFlag, boolean>> = {
  SRC_GTRENDS_RSS: true,
  SRC_GNEWS_RSS: true,
  SRC_RSS: true,
  SRC_GDELT: true,
};

const trueValues = new Set(["1", "true", "yes", "on"]);
const falseValues = new Set(["0", "false", "no", "off"]);

/**
 * Parse source switches explicitly. An unset switch uses the documented free
 * Phase 1 default; a malformed value fails startup instead of silently
 * enabling outbound requests.
 */
export function sourceFlagEnabled(
  flag: ImplementedSourceFlag,
  environment: SourceEnvironment = process.env,
): boolean {
  const raw = environment[flag]?.trim().toLowerCase();
  if (!raw) return sourceFlagDefaults[flag];
  if (trueValues.has(raw)) return true;
  if (falseValues.has(raw)) return false;
  throw new Error(
    `${flag} must be one of true/false, 1/0, yes/no, or on/off; received ${JSON.stringify(environment[flag])}.`,
  );
}

export interface ConnectorRegistryOptions {
  environment?: SourceEnvironment;
  loadFeeds?: () => ReturnType<typeof loadFeedRegistry>;
}

export interface ConnectorDescriptor {
  sourceKey: string;
  label: string;
  makeConnector(client: FetchClient): Connector;
}

export async function connectorDescriptorsForQueue(
  queue: IngestionQueueName,
  options: ConnectorRegistryOptions = {},
): Promise<readonly ConnectorDescriptor[]> {
  const environment = options.environment ?? process.env;

  switch (queue) {
    case queueNames.googleTrends:
      if (!sourceFlagEnabled("SRC_GTRENDS_RSS", environment)) return [];
      return GOOGLE_TRENDS_MARKETS.map((market) => ({
        sourceKey: `google-trends-rss:${market}`,
        label: `Google Trends RSS · ${market}`,
        makeConnector: (client) =>
          new GoogleTrendsRssConnector(client, market),
      }));

    case queueNames.googleNews:
      if (!sourceFlagEnabled("SRC_GNEWS_RSS", environment)) return [];
      return (Object.keys(GOOGLE_NEWS_EDITIONS) as Array<
        keyof typeof GOOGLE_NEWS_EDITIONS
      >).map((edition) => ({
        sourceKey: `google-news-rss:${edition}`,
        label: `Google News RSS · ${edition}`,
        makeConnector: (client) => new GoogleNewsRssConnector(client, edition),
      }));

    case queueNames.publisherTierOne:
    case queueNames.publisherTierTwo: {
      if (!sourceFlagEnabled("SRC_RSS", environment)) return [];
      const registry = await (options.loadFeeds ?? loadFeedRegistry)();
      const tier = queue === queueNames.publisherTierOne ? 1 : 2;
      return registry.feeds
        .filter((feed) => feed.enabled && feed.tier === tier)
        .map((feed) => ({
          sourceKey: `publisher-rss:${feed.id}`,
          label: `${feed.name} RSS`,
          makeConnector: (client) => new PublisherRssConnector(client, feed),
        }));
    }

    case queueNames.gdelt:
      if (!sourceFlagEnabled("SRC_GDELT", environment)) return [];
      return (Object.keys(GDELT_DISCOVERY_QUERIES) as Array<
        keyof typeof GDELT_DISCOVERY_QUERIES
      >).map((key) => ({
        sourceKey: `gdelt-doc:${key}`,
        label: `GDELT DOC · ${key}`,
        makeConnector: (client) => new GdeltDocConnector(client, key),
      }));
  }
}

export function requestSpacingMs(queue: IngestionQueueName): number {
  if (queue === queueNames.googleTrends) return 10_000;
  if (queue === queueNames.googleNews) return 3_000;
  if (queue === queueNames.gdelt) return 6_000;
  return 500;
}

