import { readFile as defaultReadFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { z } from "zod";

import {
  confidenceLabels,
  type CuratedEventSeed,
  type UpcomingEvent,
} from "./types";

export const PAKISTAN_TIMEZONE = "Asia/Karachi";
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

const curatedSeedSchema = z
  .object({
    key: z.string().min(1).regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    category: z.string().min(1),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    all_day: z.literal(true),
    recurrence: z.literal("yearly"),
    markets: z.array(z.string().length(2)).min(1),
    confidence: z.enum(["confirmed", "reported"]),
    source_url: z.url(),
    last_verified_at: z.iso.date(),
  })
  .superRefine((seed, context) => {
    const probe = new Date(Date.UTC(2024, seed.month - 1, seed.day));
    if (
      probe.getUTCMonth() !== seed.month - 1 ||
      probe.getUTCDate() !== seed.day
    ) {
      context.addIssue({
        code: "custom",
        path: ["day"],
        message: "Day is not valid for the supplied month.",
      });
    }
  });

const curatedSeedsSchema = z.array(curatedSeedSchema).superRefine((seeds, context) => {
  const seen = new Set<string>();
  for (const [index, seed] of seeds.entries()) {
    if (seen.has(seed.key)) {
      context.addIssue({
        code: "custom",
        path: [index, "key"],
        message: `Duplicate curated event key: ${seed.key}`,
      });
    }
    seen.add(seed.key);
  }
});

type ReadTextFile = (filePath: string, encoding: "utf8") => Promise<string>;

export function parseCuratedEventsYaml(yaml: string): CuratedEventSeed[] {
  const parsed = curatedSeedsSchema.parse(parse(yaml));
  return parsed.map((seed) => ({
    key: seed.key,
    title: seed.title,
    category: seed.category,
    month: seed.month,
    day: seed.day,
    allDay: seed.all_day,
    recurrence: seed.recurrence,
    markets: seed.markets,
    confidence: seed.confidence,
    sourceUrl: seed.source_url,
    lastVerifiedAt: seed.last_verified_at,
  }));
}

export async function loadCuratedEventSeeds(options?: {
  filePath?: string;
  readFile?: ReadTextFile;
}): Promise<CuratedEventSeed[]> {
  const filePath =
    options?.filePath ?? path.join(process.cwd(), "config", "events-pk.yaml");
  const readFile = options?.readFile ?? defaultReadFile;
  return parseCuratedEventsYaml(
    await readFile(/* turbopackIgnore: true */ filePath, "utf8"),
  );
}

/**
 * Pakistan currently uses UTC+05:00 year-round. Keeping the conversion here
 * explicit makes the stored instant and the local all-day date unambiguous.
 */
export function karachiLocalMidnightToUtc(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day) - KARACHI_OFFSET_MS);
}

export function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function materializeCuratedEvents(
  seeds: CuratedEventSeed[],
  options: {
    from: Date;
    to: Date;
    timeZone?: string;
  },
): UpcomingEvent[] {
  const timeZone = options.timeZone ?? PAKISTAN_TIMEZONE;
  if (timeZone !== PAKISTAN_TIMEZONE) {
    throw new Error(
      `Curated Pakistan recurrence currently supports ${PAKISTAN_TIMEZONE} only.`,
    );
  }
  if (options.to < options.from) {
    throw new Error("The materialization end must not precede the start.");
  }

  const fromLocal = dateInTimeZone(options.from, timeZone);
  const toLocal = dateInTimeZone(options.to, timeZone);
  const fromYear = Number(fromLocal.slice(0, 4));
  const toYear = Number(toLocal.slice(0, 4));
  const events: UpcomingEvent[] = [];

  for (let year = fromYear; year <= toYear; year += 1) {
    for (const seed of seeds) {
      const localDate = `${year}-${String(seed.month).padStart(2, "0")}-${String(
        seed.day,
      ).padStart(2, "0")}`;
      if (localDate < fromLocal || localDate > toLocal) continue;

      events.push({
        id: `${seed.key}-${localDate}`,
        title: seed.title,
        category: seed.category,
        markets: [...seed.markets],
        startsAt: karachiLocalMidnightToUtc(year, seed.month, seed.day),
        endsAt: null,
        localDate,
        allDay: true,
        timezone: timeZone,
        datePrecision: "day",
        confidence: seed.confidence,
        confidenceLabel: confidenceLabels[seed.confidence],
        sourceUrls: [seed.sourceUrl],
        recurrence: seed.recurrence,
        status: "scheduled",
        lastVerifiedAt: new Date(`${seed.lastVerifiedAt}T00:00:00.000Z`),
        caveat: null,
      });
    }
  }

  return events.sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
  );
}

