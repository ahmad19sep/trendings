import "server-only";

import { safeFetch } from "@/lib/http";

import type { FetchClient } from "./types";

function mediaType(value: string | null): string {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export const safeFetchClient: FetchClient = {
  async fetch(url, options = {}) {
    const response = await safeFetch(url, {
      headers: options.headers,
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes,
    });

    const actualType = mediaType(response.headers.get("content-type"));
    if (
      options.acceptedContentTypes?.length &&
      !options.acceptedContentTypes.some(
        (accepted) => mediaType(accepted) === actualType,
      )
    ) {
      throw new TypeError(
        `Connector expected ${options.acceptedContentTypes.join(", ")} but received ${actualType || "no content type"}.`,
      );
    }

    return {
      url: response.finalUrl.href,
      status: response.status,
      headers: response.headers,
      body: response.text(),
      fetchedAt: new Date(),
    };
  },
};

