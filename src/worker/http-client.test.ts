import { describe, expect, it } from "vitest";

import type {
  DnsResolver,
  FetchImplementation,
} from "../lib/http/safe-fetch";

import {
  ConnectorHttpError,
  ConnectorNotModifiedError,
  RecordingFetchClient,
} from "./http-client";

const publicResolver: DnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

describe("RecordingFetchClient conditional requests", () => {
  it("prefers the stored ETag and exposes a bodyless 304 as a no-op", async () => {
    let requestHeaders = new Headers();
    const fetchImpl: FetchImplementation = async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      return new Response(null, { status: 304 });
    };
    const client = new RecordingFetchClient({ resolver: publicResolver, fetchImpl });
    client.setValidators({
      etag: '"feed-v2"',
      lastModified: "Mon, 23 Nov 2026 10:00:00 GMT",
    });

    await expect(client.fetch("https://example.test/feed")).rejects.toEqual(
      expect.objectContaining({
        name: "ConnectorNotModifiedError",
        status: 304,
      }),
    );

    expect(requestHeaders.get("if-none-match")).toBe('"feed-v2"');
    expect(requestHeaders.has("if-modified-since")).toBe(false);
    expect(client.payloads).toEqual([]);
  });

  it("falls back to Last-Modified and keeps recording normal 200 responses", async () => {
    let requestHeaders = new Headers();
    const fetchImpl: FetchImplementation = async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      return new Response("<rss />", {
        status: 200,
        headers: {
          "content-type": "application/rss+xml",
          etag: '"feed-v3"',
        },
      });
    };
    const client = new RecordingFetchClient({ resolver: publicResolver, fetchImpl });
    client.setValidators({
      etag: null,
      lastModified: "Mon, 23 Nov 2026 10:00:00 GMT",
    });

    const response = await client.fetch("https://example.test/feed", {
      acceptedContentTypes: ["application/rss+xml"],
    });

    expect(requestHeaders.get("if-modified-since")).toBe(
      "Mon, 23 Nov 2026 10:00:00 GMT",
    );
    expect(response.status).toBe(200);
    expect(response.body).toBe("<rss />");
    expect(client.payloads).toHaveLength(1);
    expect(client.payloads[0]).toMatchObject({
      status: 200,
      etag: '"feed-v3"',
      body: "<rss />",
    });
  });

  it("uses the exported error type for 304 control flow", () => {
    const fetchedAt = new Date("2026-11-24T12:00:00.000Z");
    const error = new ConnectorNotModifiedError(
      "https://example.test/feed",
      fetchedAt,
    );

    expect(error).toMatchObject({ status: 304, fetchedAt });
  });

  it("records an untyped 429 body before exposing retry metadata", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response(new TextEncoder().encode("rate limited"), {
        status: 429,
        headers: { "retry-after": "7" },
      });
    const client = new RecordingFetchClient({ resolver: publicResolver, fetchImpl });

    await expect(
      client.fetch("https://example.test/feed", {
        acceptedContentTypes: ["application/json"],
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "ConnectorHttpError",
        status: 429,
        retryAfterMs: 7_000,
      }),
    );

    expect(client.payloads).toHaveLength(1);
    expect(client.payloads[0]).toMatchObject({
      status: 429,
      contentType: null,
      body: "rate limited",
    });
  });

  it("does not record a successful response rejected by connector type", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response("<html>not json</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    const client = new RecordingFetchClient({ resolver: publicResolver, fetchImpl });

    await expect(
      client.fetch("https://example.test/feed", {
        acceptedContentTypes: ["application/json"],
      }),
    ).rejects.toThrow("Connector rejected response media type text/html");

    expect(client.payloads).toEqual([]);
  });

  it("uses the exported HTTP error type for provider failures", () => {
    const error = new ConnectorHttpError("Provider returned HTTP 503.", 503, null);

    expect(error).toMatchObject({ status: 503, retryAfterMs: null });
  });
});
