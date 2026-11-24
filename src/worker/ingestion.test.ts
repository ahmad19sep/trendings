import { describe, expect, it, vi } from "vitest";

import { GoogleTrendsRssConnector } from "../lib/connectors";
import type {
  DnsResolver,
  FetchImplementation,
} from "../lib/http/safe-fetch";

import { RecordingFetchClient } from "./http-client";
import { runDescriptor } from "./ingestion";
import type { ConnectorDescriptor } from "./registry";

const publicResolver: DnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

describe("conditional ingestion", () => {
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
