export type VerifiedLimit<T> = {
  readonly value: T;
  readonly verifiedOn: string;
  readonly sourceUrl: string;
  readonly note?: string;
};

const verifiedOn = "2026-11-23";

/**
 * External limits are kept here so they cannot quietly become folklore in a
 * connector. `null` means the provider does not publish a contractual limit.
 * Operator pacing is deliberately more conservative than undocumented feeds.
 */
export const limits = {
  outbound: {
    timeoutMs: {
      value: 20_000,
      verifiedOn,
      sourceUrl: "internal://security-policy",
      note: "Application safety limit, not a provider quota.",
    },
    maxResponseBytes: {
      value: 5 * 1024 * 1024,
      verifiedOn,
      sourceUrl: "internal://security-policy",
      note: "Application safety limit, not a provider quota.",
    },
    maxRedirects: {
      value: 3,
      verifiedOn,
      sourceUrl: "internal://security-policy",
    },
    globalRequestsPerSecond: {
      value: 2,
      verifiedOn,
      sourceUrl: "internal://cost-and-reliability-policy",
    },
  },
  googleTrendsRss: {
    providerQuota: {
      value: null,
      verifiedOn,
      sourceUrl: "https://support.google.com/trends/answer/3076011",
      note: "Google documents RSS export but no schema, quota, or polling contract.",
    },
    operatorMinimumIntervalMs: {
      value: 30 * 60 * 1000,
      verifiedOn,
      sourceUrl: "internal://connector-pacing-policy",
      note: "Per-market polling interval chosen by this application.",
    },
  },
  googleNewsRss: {
    providerQuota: {
      value: null,
      verifiedOn,
      sourceUrl: "https://news.google.com/rss",
      note: "No supported developer API, schema, or rate-limit contract is published.",
    },
    operatorMinimumSpacingMs: {
      value: 3_000,
      verifiedOn,
      sourceUrl: "internal://connector-pacing-policy",
    },
  },
  gdelt: {
    maxRecords: {
      value: 250,
      verifiedOn,
      sourceUrl: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
    },
    providerRequestsPerSecond: {
      value: null,
      verifiedOn,
      sourceUrl: "https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/",
      note: "No reliable current request-rate contract was found; pace conservatively.",
    },
    operatorMinimumSpacingMs: {
      value: 6_000,
      verifiedOn,
      sourceUrl: "internal://connector-pacing-policy",
    },
  },
  youtube: {
    defaultDailyUnits: {
      value: 10_000,
      verifiedOn,
      sourceUrl: "https://developers.google.com/youtube/v3/determine_quota_cost",
    },
    searchDefaultCallsPerDay: {
      value: 100,
      verifiedOn,
      sourceUrl: "https://developers.google.com/youtube/v3/docs/search/list",
      note: "The search method uses its own default daily call bucket.",
    },
    maxResultsPerCall: {
      value: 50,
      verifiedOn,
      sourceUrl: "https://developers.google.com/youtube/v3/docs/search/list",
    },
    unauthorisedDataRefreshDays: {
      value: 30,
      verifiedOn,
      sourceUrl: "https://developers.google.com/youtube/terms/developer-policies",
    },
  },
  tmdb: {
    softRequestsPerSecond: {
      value: 40,
      verifiedOn,
      sourceUrl: "https://developer.themoviedb.org/docs/rate-limiting",
      note: "TMDB describes this as an approximate upper bound; always honor 429.",
    },
  },
  nager: {
    requestsPerSecond: {
      value: null,
      verifiedOn,
      sourceUrl: "https://date.nager.at/Api",
      note: "The official v4 page currently states unlimited requests and no rate limit.",
    },
  },
  telegram: {
    messagesPerSecondPerChat: {
      value: 1,
      verifiedOn,
      sourceUrl: "https://core.telegram.org/bots/faq",
    },
    messagesPerMinutePerGroup: {
      value: 20,
      verifiedOn,
      sourceUrl: "https://core.telegram.org/bots/faq",
    },
    bulkMessagesPerSecond: {
      value: 30,
      verifiedOn,
      sourceUrl: "https://core.telegram.org/bots/faq",
    },
  },
} as const satisfies Record<string, Record<string, VerifiedLimit<unknown>>>;

