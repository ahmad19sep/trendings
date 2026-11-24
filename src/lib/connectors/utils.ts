import { createHash } from "node:crypto";

import { XMLParser } from "fast-xml-parser";

import type { ConnectorHealth, FetchClientResponse } from "./types";

export type XmlRecord = Record<string, unknown>;

export const feedXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
});

export function asRecord(value: unknown): XmlRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as XmlRecord)
    : null;
}

export function asArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function textValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text.length > 0 ? text : null;
  }

  const record = asRecord(value);
  if (!record) return null;
  return textValue(record["#text"] ?? record["_"]);
}

export function attributeValue(value: unknown, attribute: string): string | null {
  const record = asRecord(value);
  return record ? textValue(record[`@${attribute}`]) : null;
}

export function parseDateToIso(value: unknown): string | null {
  const text = textValue(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function fetchedAtIso(response: FetchClientResponse): string {
  const value = response.fetchedAt;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Fetch client returned an invalid fetchedAt value");
  }
  return date.toISOString();
}

export function stableId(...parts: readonly (string | number | null)[]): string {
  return createHash("sha256")
    .update(parts.map((part) => part ?? "<null>").join("\u001f"))
    .digest("hex");
}

export function payloadHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function parseApproximateLowerBound(value: unknown): number | null {
  const raw = textValue(value);
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function stripMarkup(value: unknown, maxCharacters = 300): string | null {
  const raw = textValue(value);
  if (!raw) return null;

  const plain = raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return null;
  return Array.from(plain).slice(0, maxCharacters).join("");
}

export function getHeader(
  headers: Headers | Readonly<Record<string, string>>,
  name: string,
): string | null {
  if (headers instanceof Headers) return headers.get(name);
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return match?.[1] ?? null;
}

export function assertSuccessfulFeedResponse(response: FetchClientResponse): void {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Feed request failed with HTTP ${response.status}`);
  }
}

export class HealthTracker {
  private snapshot: ConnectorHealth = {
    status: "idle",
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    lastHttpStatus: null,
    itemsLastRun: null,
  };

  attempt(at = new Date()): void {
    this.snapshot = { ...this.snapshot, lastAttemptAt: at.toISOString() };
  }

  success(httpStatus: number, itemCount: number, at = new Date()): void {
    this.snapshot = {
      ...this.snapshot,
      status: "healthy",
      lastAttemptAt: this.snapshot.lastAttemptAt ?? at.toISOString(),
      lastSuccessAt: at.toISOString(),
      lastError: null,
      lastHttpStatus: httpStatus,
      itemsLastRun: itemCount,
    };
  }

  failure(error: unknown, httpStatus: number | null = null, at = new Date()): void {
    this.snapshot = {
      ...this.snapshot,
      status: "error",
      lastAttemptAt: this.snapshot.lastAttemptAt ?? at.toISOString(),
      lastErrorAt: at.toISOString(),
      lastError: error instanceof Error ? error.message : String(error),
      lastHttpStatus: httpStatus,
      itemsLastRun: null,
    };
  }

  read(): ConnectorHealth {
    return { ...this.snapshot };
  }
}
