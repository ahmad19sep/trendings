import { describe, expect, it, vi } from "vitest";

import { GoogleTrendsRssConnector } from "../lib/connectors";
import { TEST_ONLY_GOOGLE_TRENDS_XML } from "../lib/connectors/__fixtures__/test-only-feeds";
import type {
  DnsResolver,
  FetchImplementation,
} from "../lib/http/safe-fetch";

import { ConnectorHttpError, RecordingFetchClient } from "./http-client";
import { retryDelay, runDescriptor } from "./ingestion";
import type { ConnectorDescriptor } from "./registry";

const publicResolver: DnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

describe("conditional ingestion", () => {
  it("waits at least six seconds for an unhinted 429 retry", () => {
    const error = new ConnectorHttpError(
      "Provider returned HTTP 429.",
      429,
      null,
    );

    expect(retryDelay(error, 1)).toBeGreaterThanOrEqual(6_000);
    expect(retryDelay(error, 2)).toBeGreaterThanOrEqual(6_000);
    expect(retryDelay(error, 3)).toBeGreaterThanOrEqual(6_000);
  });

  it("persists a successful batch and source completion in one transaction", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response(TEST_ONLY_GOOGLE_TRENDS_XML, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      });
    const client = new RecordingFetchClient({ resolver: publicResolver, fetchImpl });
    const descriptor: ConnectorDescriptor = {
      sourceKey: "google-trends-rss:PK",
      label: "Google Trends RSS · PK",
      makeConnector: (fetchClient) =>
        new GoogleTrendsRssConnector(fetchClient, "PK"),
    };
    const transactionContext = { kind: "transaction" };
    const transaction = vi.fn(
      async (
        callback: (tx: typeof transactionContext) => Promise<unknown>,
      ) => callback(transactionContext),
    );
    const db = { transaction } as never;
    const persistRawPayloads = vi.fn(async () => ["raw-payload-id"]);
    const persistItems = vi.fn(async () => ({
      count: 2,
      itemIds: ["item-1", "item-2"],
      listLength: 2,
    }));
    const materializeItemsIntoTopics = vi.fn(async () => ({
      itemCount: 2,
      itemsLinked: 2,
      topicsCreated: 2,
      topicIds: ["topic-1", "topic-2"],
    }));
    const finishSourceRun = vi.fn(async () => undefined);
    const failSourceRun = vi.fn(async () => undefined);

    const result = await runDescriptor(db, descriptor, {
      createClient: () => client,
      upsertSource: vi.fn(async () => ({
        id: "source-id",
        key: descriptor.sourceKey,
      })),
      loadLatestHttpValidators: vi.fn(async () => ({
        etag: null,
        lastModified: null,
      })),
      startSourceRun: vi.fn(async () => "source-run-id"),
      persistRawPayloads,
      persistItems,
      materializeItemsIntoTopics,
      finishSourceRun,
      failSourceRun,
      sleep: vi.fn(async () => undefined),
    });

    expect(result).toEqual({
      sourceKey: descriptor.sourceKey,
      status: "success",
      items: 2,
      attempts: 1,
    });
    expect(transaction).toHaveBeenCalledOnce();
    expect(persistRawPayloads).toHaveBeenCalledWith(transactionContext, {
      sourceId: "source-id",
      sourceRunId: "source-run-id",
      payloads: client.payloads,
    });
    expect(persistItems).toHaveBeenCalledWith(transactionContext, {
      source: { id: "source-id", key: descriptor.sourceKey },
      items: expect.any(Array),
      rawPayloadId: "raw-payload-id",
    });
    expect(materializeItemsIntoTopics).toHaveBeenCalledWith(
      transactionContext,
      {
        itemIds: ["item-1", "item-2"],
        listLength: 2,
      },
    );
    expect(finishSourceRun).toHaveBeenCalledWith(transactionContext, {
      sourceId: "source-id",
      sourceRunId: "source-run-id",
      itemsFetched: 2,
      attempts: 1,
    });
    expect(failSourceRun).not.toHaveBeenCalled();
  });

  it("links items to the successful payload after a retained 429 retry", async () => {
    let attempts = 0;
    const fetchImpl: FetchImplementation = async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("rate limited", { status: 429 });
      }
      return new Response(TEST_ONLY_GOOGLE_TRENDS_XML, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      });
    };
    const client = new RecordingFetchClient({ resolver: publicResolver, fetchImpl });
    const descriptor: ConnectorDescriptor = {
      sourceKey: "google-trends-rss:PK",
      label: "Google Trends RSS · PK",
      makeConnector: (fetchClient) =>
        new GoogleTrendsRssConnector(fetchClient, "PK"),
    };
    const transactionContext = { kind: "transaction" };
    const persistItems = vi.fn(async () => ({
      count: 2,
      itemIds: ["item-1", "item-2"],
      listLength: 2,
    }));

    const result = await runDescriptor(
      {
        transaction: async (
          callback: (tx: typeof transactionContext) => Promise<unknown>,
        ) => callback(transactionContext),
      } as never,
      descriptor,
      {
        createClient: () => client,
        upsertSource: vi.fn(async () => ({
          id: "source-id",
          key: descriptor.sourceKey,
        })),
        loadLatestHttpValidators: vi.fn(async () => ({
          etag: null,
          lastModified: null,
        })),
        startSourceRun: vi.fn(async () => "source-run-id"),
        persistRawPayloads: vi.fn(async () => [
          "rate-limit-payload-id",
          "successful-payload-id",
        ]),
        persistItems,
        materializeItemsIntoTopics: vi.fn(async () => ({
          itemCount: 2,
          itemsLinked: 2,
          topicsCreated: 2,
          topicIds: ["topic-1", "topic-2"],
        })),
        finishSourceRun: vi.fn(async () => undefined),
        failSourceRun: vi.fn(async () => undefined),
        sleep: vi.fn(async () => undefined),
      },
    );

    expect(result).toMatchObject({ status: "success", attempts: 2 });
    expect(client.payloads.map((payload) => payload.status)).toEqual([429, 200]);
    expect(persistItems).toHaveBeenCalledWith(transactionContext, {
      source: { id: "source-id", key: descriptor.sourceKey },
      items: expect.any(Array),
      rawPayloadId: "successful-payload-id",
    });
  });

  it("finishes a 304 as a healthy one-attempt no-op", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response(null, { status: 304 });
    const client = new RecordingFetchClient({ resolver: publicResolver, fetchImpl });
    const descriptor: ConnectorDescriptor = {
      sourceKey: "google-trends-rss:PK",
      label: "Google Trends RSS · PK",
      makeConnector: (fetchClient) =>
        new GoogleTrendsRssConnector(fetchClient, "PK"),
    };
    const persistRawPayloads = vi.fn(async () => [] as string[]);
    const persistItems = vi.fn(async () => ({
      count: 0,
      itemIds: [] as string[],
      listLength: 0,
    }));
    const materializeItemsIntoTopics = vi.fn(async () => ({
      itemCount: 0,
      itemsLinked: 0,
      topicsCreated: 0,
      topicIds: [] as string[],
    }));
    const finishSourceRun = vi.fn(async () => undefined);
    const failSourceRun = vi.fn(async () => undefined);
    const sleep = vi.fn(async () => undefined);

    const result = await runDescriptor({} as never, descriptor, {
      createClient: () => client,
      upsertSource: vi.fn(async () => ({
        id: "source-id",
        key: descriptor.sourceKey,
      })),
      loadLatestHttpValidators: vi.fn(async () => ({
        etag: '"feed-v2"',
        lastModified: null,
      })),
      startSourceRun: vi.fn(async () => "source-run-id"),
      persistRawPayloads,
      persistItems,
      materializeItemsIntoTopics,
      finishSourceRun,
      failSourceRun,
      sleep,
    });

    expect(result).toEqual({
      sourceKey: descriptor.sourceKey,
      status: "success",
      items: 0,
      attempts: 1,
      notModified: true,
    });
    expect(client.payloads).toEqual([]);
    expect(persistRawPayloads).not.toHaveBeenCalled();
    expect(persistItems).not.toHaveBeenCalled();
    expect(materializeItemsIntoTopics).not.toHaveBeenCalled();
    expect(failSourceRun).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
    expect(finishSourceRun).toHaveBeenCalledOnce();
    expect(finishSourceRun).toHaveBeenCalledWith({} as never, {
      sourceId: "source-id",
      sourceRunId: "source-run-id",
      itemsFetched: 0,
      attempts: 1,
      httpStatus: 304,
      notModified: true,
    });
  });
});
