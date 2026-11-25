import { describe, expect, it, vi } from "vitest";

import {
  SafeFetchError,
  isPublicIpAddress,
  parseRetryAfter,
  safeFetch,
  sanitizeRequestHeaders,
  type DnsResolver,
  type FetchImplementation,
} from "./safe-fetch";

const publicResolver: DnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

function expectCode(code: SafeFetchError["code"]) {
  return expect.objectContaining({ code });
}

describe("isPublicIpAddress", () => {
  it.each([
    "127.0.0.1",
    "169.254.169.254",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::",
    "::1",
    "fe80::1",
    "fd00:ec2::254",
    "ff02::1",
    "::ffff:127.0.0.1",
  ])("blocks non-public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])(
    "accepts public unicast address %s",
    (address) => {
      expect(isPublicIpAddress(address)).toBe(true);
    },
  );
});

describe("safeFetch URL and DNS validation", () => {
  it.each([
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://[::1]/",
    "http://[fe80::1]/",
  ])("rejects blocked literal %s before fetching", async (url) => {
    const fetchImpl = vi.fn<FetchImplementation>();

    await expect(safeFetch(url, { fetchImpl })).rejects.toEqual(
      expectCode("BLOCKED_ADDRESS"),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a hostname when any DNS answer is private", async () => {
    const resolver: DnsResolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.7", family: 4 },
    ];
    const fetchImpl = vi.fn<FetchImplementation>();

    await expect(
      safeFetch("https://example.test", { resolver, fetchImpl }),
    ).rejects.toEqual(expectCode("BLOCKED_ADDRESS"));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["file:///etc/passwd", "UNSUPPORTED_PROTOCOL"],
    ["https://user:pass@example.test/", "EMBEDDED_CREDENTIALS"],
    ["https://example.test:8443/", "INVALID_PORT"],
    ["http://localhost/", "BLOCKED_HOST"],
  ] as const)("rejects %s with %s", async (url, code) => {
    await expect(safeFetch(url)).rejects.toEqual(expectCode(code));
  });
});

describe("safeFetch redirects", () => {
  it("re-resolves and blocks a redirect target before the second fetch", async () => {
    const resolver: DnsResolver = async (hostname) =>
      hostname === "public.test"
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "169.254.169.254", family: 4 }];
    const fetchImpl = vi.fn<FetchImplementation>().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://metadata.test/latest" },
      }),
    );

    await expect(
      safeFetch("https://public.test", { resolver, fetchImpl }),
    ).rejects.toEqual(expectCode("BLOCKED_ADDRESS"));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("enforces the redirect limit", async () => {
    const fetchImpl = vi.fn<FetchImplementation>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "/again" },
      }),
    );

    await expect(
      safeFetch("https://example.test", {
        resolver: publicResolver,
        fetchImpl,
        maxRedirects: 1,
      }),
    ).rejects.toEqual(expectCode("TOO_MANY_REDIRECTS"));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("safeFetch response constraints", () => {
  it("returns an allowed bounded response", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });

    const result = await safeFetch("https://example.test/feed", {
      resolver: publicResolver,
      fetchImpl,
    });

    expect(result.status).toBe(200);
    expect(result.finalUrl.href).toBe("https://example.test/feed");
    expect(result.json()).toEqual({ ok: true });
  });

  it("accepts a bodyless 304 response without a Content-Type header", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response(null, {
        status: 304,
        headers: { etag: '"feed-v2"' },
      });

    const result = await safeFetch("https://example.test/feed", {
      resolver: publicResolver,
      fetchImpl,
    });

    expect(result.status).toBe(304);
    expect(result.headers.get("etag")).toBe('"feed-v2"');
    expect(result.body).toHaveLength(0);
    expect(result.text()).toBe("");
  });

  it("returns a bounded HTTP error that omits Content-Type", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response(new TextEncoder().encode("slow down"), {
        status: 429,
        headers: { "content-length": "9" },
      });

    const result = await safeFetch("https://example.test/feed", {
      resolver: publicResolver,
      fetchImpl,
    });

    expect(result.status).toBe(429);
    expect(result.headers.get("content-type")).toBeNull();
    expect(result.text()).toBe("slow down");
  });

  it("still requires Content-Type on successful responses", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response(new TextEncoder().encode("untyped success"), { status: 200 });

    await expect(
      safeFetch("https://example.test/feed", {
        resolver: publicResolver,
        fetchImpl,
      }),
    ).rejects.toEqual(expectCode("UNSUPPORTED_CONTENT_TYPE"));
  });

  it("rejects unsupported media types", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "application/octet-stream" },
      });

    await expect(
      safeFetch("https://example.test/file", {
        resolver: publicResolver,
        fetchImpl,
      }),
    ).rejects.toEqual(expectCode("UNSUPPORTED_CONTENT_TYPE"));
  });

  it("rejects a declared oversized response", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response("small", {
        headers: {
          "content-type": "text/plain",
          "content-length": "101",
        },
      });

    await expect(
      safeFetch("https://example.test/file", {
        resolver: publicResolver,
        fetchImpl,
        maxBytes: 100,
      }),
    ).rejects.toEqual(expectCode("RESPONSE_TOO_LARGE"));
  });

  it("stops a streaming response that exceeds the limit", async () => {
    const fetchImpl: FetchImplementation = async () =>
      new Response(new Uint8Array(101), {
        headers: { "content-type": "application/xml" },
      });

    await expect(
      safeFetch("https://example.test/feed", {
        resolver: publicResolver,
        fetchImpl,
        maxBytes: 100,
      }),
    ).rejects.toEqual(expectCode("RESPONSE_TOO_LARGE"));
  });
});

describe("request sanitation and Retry-After", () => {
  it("removes credentials and hop-by-hop headers", () => {
    const headers = sanitizeRequestHeaders({
      authorization: "Bearer secret",
      cookie: "session=secret",
      "x-api-key": "secret",
      host: "internal.test",
      "if-none-match": '"etag"',
    });

    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-api-key")).toBe(false);
    expect(headers.has("host")).toBe(false);
    expect(headers.get("if-none-match")).toBe('"etag"');
    expect(headers.get("user-agent")).toContain("CreatorTrendRadar");
  });

  it("parses delta seconds and HTTP dates", () => {
    const now = Date.parse("2026-11-23T00:00:00Z");
    expect(parseRetryAfter("12", now)).toBe(12_000);
    expect(parseRetryAfter("Mon, 23 Nov 2026 00:00:30 GMT", now)).toBe(
      30_000,
    );
    expect(parseRetryAfter("not-a-date", now)).toBeNull();
  });
});

