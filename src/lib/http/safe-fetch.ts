import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import ipaddr from "ipaddr.js";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_USER_AGENT =
  "CreatorTrendRadar/0.1 (+personal trend research; safe-fetch)";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SENSITIVE_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "cookie2",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
]);
const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export type SafeFetchErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "INVALID_PORT"
  | "EMBEDDED_CREDENTIALS"
  | "BLOCKED_HOST"
  | "DNS_FAILED"
  | "BLOCKED_ADDRESS"
  | "FETCH_FAILED"
  | "TIMEOUT"
  | "TOO_MANY_REDIRECTS"
  | "REDIRECT_MISSING_LOCATION"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "RESPONSE_TOO_LARGE";

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;
  readonly cause?: unknown;

  constructor(code: SafeFetchErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
    this.cause = cause;
  }
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type DnsResolver = (
  hostname: string,
) => Promise<readonly ResolvedAddress[]>;

export type FetchImplementation = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface SafeFetchOptions {
  headers?: HeadersInit;
  method?: "GET" | "HEAD";
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
  resolver?: DnsResolver;
  fetchImpl?: FetchImplementation;
  userAgent?: string;
}

export interface SafeFetchResponse {
  readonly finalUrl: URL;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly body: Uint8Array;
  text(): string;
  json<T = unknown>(): T;
}

export async function safeFetch(
  input: string | URL,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResponse> {
  const timeoutMs = positiveInteger(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    "timeoutMs",
  );
  const maxBytes = positiveInteger(
    options.maxBytes ?? DEFAULT_MAX_BYTES,
    "maxBytes",
  );
  const maxRedirects = nonNegativeInteger(
    options.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    "maxRedirects",
  );
  const resolver = options.resolver ?? defaultResolver;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const requestHeaders = sanitizeRequestHeaders(
    options.headers,
    options.userAgent ?? DEFAULT_USER_AGENT,
  );
  const method = options.method ?? "GET";

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutController.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);
  const detachExternalSignal = forwardAbort(options.signal, timeoutController);

  try {
    let currentUrl = parseAndValidateUrl(input);

    for (let redirects = 0; ; redirects += 1) {
      await validateResolvedHost(currentUrl, resolver, timeoutController.signal);

      let response: Response;
      try {
        response = await abortable(
          fetchImpl(currentUrl, {
            method,
            headers: requestHeaders,
            redirect: "manual",
            credentials: "omit",
            cache: "no-store",
            signal: timeoutController.signal,
          }),
          timeoutController.signal,
        );
      } catch (error) {
        throw normalizeFetchError(error, timeoutController.signal);
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        if (redirects >= maxRedirects) {
          throw new SafeFetchError(
            "TOO_MANY_REDIRECTS",
            `Refused more than ${maxRedirects} redirects`,
          );
        }

        const location = response.headers.get("location");
        if (!location) {
          throw new SafeFetchError(
            "REDIRECT_MISSING_LOCATION",
            `Redirect response ${response.status} did not include a Location header`,
          );
        }

        try {
          currentUrl = parseAndValidateUrl(new URL(location, currentUrl));
        } catch (error) {
          if (error instanceof SafeFetchError) throw error;
          throw new SafeFetchError(
            "INVALID_URL",
            "Redirect target is not a valid URL",
            error,
          );
        }
        continue;
      }

      const hasNoResponseBody = method === "HEAD" || response.status === 304;
      if (!hasNoResponseBody) {
        assertAllowedContentType(
          response.headers.get("content-type"),
          response.status >= 400,
        );
      }
      assertDeclaredSize(response.headers.get("content-length"), maxBytes);
      const body =
        hasNoResponseBody
          ? new Uint8Array()
          : await readBoundedBody(response, maxBytes, timeoutController.signal);

      return makeResult(currentUrl, response, body);
    }
  } finally {
    clearTimeout(timeout);
    detachExternalSignal();
  }
}

export function sanitizeRequestHeaders(
  input: HeadersInit | undefined,
  userAgent = DEFAULT_USER_AGENT,
): Headers {
  const headers = new Headers(input);
  for (const name of [...SENSITIVE_REQUEST_HEADERS, ...HOP_BY_HOP_REQUEST_HEADERS]) {
    headers.delete(name);
  }
  headers.set(
    "accept",
    headers.get("accept") ??
      "application/json, application/feed+json, application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, text/plain;q=0.9",
  );
  headers.set("user-agent", userAgent);
  return headers;
}

export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) * 1_000;
  }

  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

export function isPublicIpAddress(address: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(stripIpv6Brackets(address));
  } catch {
    return false;
  }

  if (parsed.kind() === "ipv6") {
    const ipv6 = parsed as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) {
      return ipv6.toIPv4Address().range() === "unicast";
    }
  }

  // ipaddr.js classifies private, loopback, link-local, CGNAT, multicast,
  // transition, documentation, benchmarking, and reserved space separately.
  // Only ordinary globally routable unicast addresses pass this boundary.
  return parsed.range() === "unicast";
}

async function defaultResolver(
  hostname: string,
): Promise<readonly ResolvedAddress[]> {
  const normalized = stripIpv6Brackets(hostname);
  const family = isIP(normalized);
  if (family === 4 || family === 6) {
    return [{ address: normalized, family }];
  }

  try {
    const results = await lookup(normalized, { all: true, verbatim: true });
    return results.map((result) => ({
      address: result.address,
      family: result.family === 6 ? 6 : 4,
    }));
  } catch (error) {
    throw new SafeFetchError(
      "DNS_FAILED",
      `Could not resolve ${normalized}`,
      error,
    );
  }
}

function parseAndValidateUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input.href) : new URL(input);
  } catch (error) {
    throw new SafeFetchError("INVALID_URL", "Input is not a valid URL", error);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError(
      "UNSUPPORTED_PROTOCOL",
      `Protocol ${url.protocol || "(missing)"} is not allowed`,
    );
  }
  if (url.username || url.password) {
    throw new SafeFetchError(
      "EMBEDDED_CREDENTIALS",
      "URLs containing embedded credentials are not allowed",
    );
  }
  if (!url.hostname) {
    throw new SafeFetchError("INVALID_URL", "URL hostname is required");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new SafeFetchError(
      "INVALID_PORT",
      `Port ${url.port} is not allowed; use port 80 or 443`,
    );
  }

  const hostname = stripIpv6Brackets(url.hostname).toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new SafeFetchError(
      "BLOCKED_HOST",
      `Local hostname ${hostname} is not allowed`,
    );
  }

  return url;
}

async function validateResolvedHost(
  url: URL,
  resolver: DnsResolver,
  signal: AbortSignal,
): Promise<void> {
  const hostname = stripIpv6Brackets(url.hostname);
  let addresses: readonly ResolvedAddress[];
  try {
    addresses = await abortable(resolver(hostname), signal);
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    if (signal.aborted) throw timeoutError(signal.reason);
    throw new SafeFetchError(
      "DNS_FAILED",
      `Could not resolve ${hostname}`,
      error,
    );
  }

  if (addresses.length === 0) {
    throw new SafeFetchError(
      "DNS_FAILED",
      `Resolver returned no addresses for ${hostname}`,
    );
  }

  for (const { address } of addresses) {
    if (!isPublicIpAddress(address)) {
      throw new SafeFetchError(
        "BLOCKED_ADDRESS",
        `Resolved address for ${hostname} is not public`,
      );
    }
  }
}

function assertAllowedContentType(
  contentType: string | null,
  allowMissing = false,
): void {
  if (!contentType) {
    // Some providers omit Content-Type on bounded HTTP error bodies. Let the
    // caller interpret the status (and Retry-After) without weakening type
    // checks for successful responses or explicitly unsafe media types.
    if (allowMissing) return;
    throw new SafeFetchError(
      "UNSUPPORTED_CONTENT_TYPE",
      "Response is missing a Content-Type header",
    );
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const allowed =
    mediaType.startsWith("text/") ||
    mediaType === "application/json" ||
    mediaType === "application/feed+json" ||
    mediaType === "application/xml" ||
    mediaType === "application/rss+xml" ||
    mediaType === "application/atom+xml" ||
    mediaType === "application/xhtml+xml" ||
    mediaType.endsWith("+json") ||
    mediaType.endsWith("+xml");

  if (!allowed) {
    throw new SafeFetchError(
      "UNSUPPORTED_CONTENT_TYPE",
      `Response media type ${mediaType || "(empty)"} is not allowed`,
    );
  }
}

function assertDeclaredSize(value: string | null, maxBytes: number): void {
  if (!value || !/^\d+$/.test(value.trim())) return;
  const declaredSize = Number.parseInt(value, 10);
  if (declaredSize > maxBytes) {
    throw new SafeFetchError(
      "RESPONSE_TOO_LARGE",
      `Response declares ${declaredSize} bytes; limit is ${maxBytes}`,
    );
  }
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const result = await abortable(reader.read(), signal);
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response size limit exceeded").catch(() => undefined);
        throw new SafeFetchError(
          "RESPONSE_TOO_LARGE",
          `Response exceeded the ${maxBytes}-byte limit`,
        );
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    if (signal.aborted) throw timeoutError(signal.reason);
    throw new SafeFetchError("FETCH_FAILED", "Failed while reading response", error);
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function makeResult(
  finalUrl: URL,
  response: Response,
  body: Uint8Array,
): SafeFetchResponse {
  return {
    finalUrl: new URL(finalUrl.href),
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
    body,
    text: () => new TextDecoder().decode(body),
    json: <T = unknown>() => JSON.parse(new TextDecoder().decode(body)) as T,
  };
}

function forwardAbort(
  source: AbortSignal | undefined,
  target: AbortController,
): () => void {
  if (!source) return () => undefined;
  const abort = () => target.abort(source.reason);
  if (source.aborted) {
    abort();
    return () => undefined;
  }
  source.addEventListener("abort", abort, { once: true });
  return () => source.removeEventListener("abort", abort);
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(timeoutError(signal.reason));

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(timeoutError(signal.reason));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

function normalizeFetchError(
  error: unknown,
  signal: AbortSignal,
): SafeFetchError {
  if (error instanceof SafeFetchError) return error;
  if (signal.aborted) return timeoutError(signal.reason);
  return new SafeFetchError("FETCH_FAILED", "Outbound request failed", error);
}

function timeoutError(cause?: unknown): SafeFetchError {
  return new SafeFetchError(
    "TIMEOUT",
    "Outbound request exceeded its timeout",
    cause,
  );
}

function stripIpv6Brackets(value: string): string {
  return value.startsWith("[") && value.endsWith("]")
    ? value.slice(1, -1)
    : value;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
  return value;
}

