import { createHash } from "node:crypto";

import type {
  FetchClient,
  FetchClientOptions,
  FetchClientResponse,
} from "../lib/connectors";
import {
  parseRetryAfter,
  safeFetch,
  type SafeFetchOptions,
} from "../lib/http/safe-fetch";

export interface RecordedPayload {
  url: string;
  status: number;
  fetchedAt: Date;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  body: string;
  contentHash: string;
}

export interface HttpValidators {
  etag: string | null;
  lastModified: string | null;
}

export class ConnectorNotModifiedError extends Error {
  readonly status = 304;

  constructor(
    readonly url: string,
    readonly fetchedAt: Date,
  ) {
    super("Provider content has not changed since the previous successful fetch.");
    this.name = "ConnectorNotModifiedError";
  }
}

export class ConnectorHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = "ConnectorHttpError";
  }
}

/**
 * Adapts the central SSRF-safe fetcher to the connector contract while keeping
 * an in-memory copy of this run's raw responses for the seven-day audit store.
 */
export class RecordingFetchClient implements FetchClient {
  readonly payloads: RecordedPayload[] = [];
  private validators: HttpValidators = { etag: null, lastModified: null };

  constructor(
    private readonly fetchOptions: Pick<
      SafeFetchOptions,
      "resolver" | "fetchImpl" | "signal"
    > = {},
  ) {}

  setValidators(validators: HttpValidators): void {
    this.validators = {
      etag: nonEmptyHeaderValue(validators.etag),
      lastModified: nonEmptyHeaderValue(validators.lastModified),
    };
  }

  async fetch(
    url: string,
    options: FetchClientOptions = {},
  ): Promise<FetchClientResponse> {
    const headers = new Headers(options.headers);
    if (this.validators.etag && !headers.has("if-none-match")) {
      headers.set("if-none-match", this.validators.etag);
    } else if (
      this.validators.lastModified &&
      !headers.has("if-modified-since")
    ) {
      headers.set("if-modified-since", this.validators.lastModified);
    }

    const response = await safeFetch(url, {
      ...this.fetchOptions,
      headers,
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes,
    });
    const fetchedAt = new Date();

    if (response.status === 304) {
      throw new ConnectorNotModifiedError(
        response.finalUrl.toString(),
        fetchedAt,
      );
    }

    const body = response.text();
    const contentType = response.headers.get("content-type");
    const recordedPayload = {
      url: response.finalUrl.toString(),
      status: response.status,
      fetchedAt,
      contentType,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      body,
      contentHash: createHash("sha256").update(body).digest("hex"),
    };

    if (response.status < 200 || response.status >= 300) {
      this.payloads.push(recordedPayload);
      throw new ConnectorHttpError(
        `Provider returned HTTP ${response.status}.`,
        response.status,
        parseRetryAfter(response.headers.get("retry-after")),
      );
    }

    if (
      options.acceptedContentTypes?.length &&
      !matchesAcceptedContentType(contentType, options.acceptedContentTypes)
    ) {
      throw new Error(
        `Connector rejected response media type ${contentType ?? "(missing)"}.`,
      );
    }

    this.payloads.push(recordedPayload);

    return {
      url: response.finalUrl.toString(),
      status: response.status,
      headers: response.headers,
      body,
      fetchedAt,
    };
  }
}

function nonEmptyHeaderValue(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function matchesAcceptedContentType(
  value: string | null,
  accepted: readonly string[],
): boolean {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return accepted.some((candidate) => candidate.toLowerCase() === mediaType);
}

