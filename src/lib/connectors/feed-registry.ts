import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";
import { z } from "zod";

import type { ContentLanguage } from "./types";

const contentLanguageSchema = z.enum([
  "en",
  "ur",
  "ur-Latn",
  "hi",
  "hi-Latn",
  "other",
  "unknown",
]);

const publisherFeedSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  url: z.url().refine((value) => value.startsWith("https://"), {
    message: "Verified publisher feeds must use HTTPS",
  }),
  country: z.string().regex(/^[A-Z]{2}$/),
  language: contentLanguageSchema,
  type: z.enum(["general", "world", "asia", "sport", "technology"]),
  tier: z.union([z.literal(1), z.literal(2)]),
  refreshMinutes: z.union([z.literal(15), z.literal(60)]),
  verifiedOn: z.iso.date(),
  enabled: z.boolean(),
});

const feedRegistrySchema = z
  .strictObject({
    version: z.literal(1),
    feeds: z.array(publisherFeedSchema).min(1),
  })
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    const urls = new Set<string>();
    for (const [index, feed] of registry.feeds.entries()) {
      if (ids.has(feed.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate feed id: ${feed.id}`,
          path: ["feeds", index, "id"],
        });
      }
      if (urls.has(feed.url)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate feed URL: ${feed.url}`,
          path: ["feeds", index, "url"],
        });
      }
      ids.add(feed.id);
      urls.add(feed.url);
    }
  });

export interface PublisherFeedDefinition {
  id: string;
  name: string;
  url: string;
  country: string;
  language: ContentLanguage;
  type: "general" | "world" | "asia" | "sport" | "technology";
  tier: 1 | 2;
  refreshMinutes: 15 | 60;
  verifiedOn: string;
  enabled: boolean;
}

export interface FeedRegistry {
  version: 1;
  feeds: readonly PublisherFeedDefinition[];
}

export function parseFeedRegistry(yaml: string): FeedRegistry {
  const parsed: unknown = parseYaml(yaml);
  return feedRegistrySchema.parse(parsed);
}

export async function loadFeedRegistry(
  registryPath = join(process.cwd(), "config", "feeds.yaml"),
): Promise<FeedRegistry> {
  return parseFeedRegistry(
    await readFile(/* turbopackIgnore: true */ registryPath, "utf8"),
  );
}
