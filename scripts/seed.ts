import { sql } from "drizzle-orm";

import { getDb, closeDb } from "../src/db/client";
import { countryCodes, events, settings } from "../src/db/schema";
import { categories } from "../src/domain/taxonomy";
import { RecordingFetchClient } from "../src/worker/http-client";
import { upsertSource } from "../src/worker/persistence";
import { connectorDescriptorsForQueue } from "../src/worker/registry";
import { oneShotIngestionQueues } from "../src/worker/schedules";
import {
  loadCuratedEventSeeds,
  materializeCuratedEvents,
} from "../src/lib/upcoming";

const DAY = 24 * 60 * 60 * 1000;

async function seedSettings() {
  const db = getDb();
  const values = [
    {
      key: "profile",
      value: {
        displayName: process.env.ADMIN_DISPLAY_NAME?.trim() || "Ahmad",
        homeMarket: "PK",
        comparisonMarkets: ["IN", "US", "GB", "AE", "SA", "WORLD"],
        timezone: "Asia/Karachi",
      },
    },
    {
      key: "taxonomy",
      value: { categories: [...categories], synonyms: {} },
    },
    {
      key: "digest",
      value: {
        time: "08:00",
        timezone: "Asia/Karachi",
        quietHours: { start: "23:00", end: "08:00" },
      },
    },
    {
      key: "ai",
      value: { mode: "off", enabled: false, monthlyCapUsd: 0 },
    },
  ];

  for (const value of values) {
    await db
      .insert(settings)
      .values(value)
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: value.value, updatedAt: new Date() },
      });
  }
}

async function seedCountryCodes() {
  const rows = [
    { iso2: "PK", name: "Pakistan", fips: "PK" },
    { iso2: "IN", name: "India", fips: "IN" },
    { iso2: "US", name: "United States", fips: "US" },
    { iso2: "GB", name: "United Kingdom", fips: "UK" },
    { iso2: "AE", name: "United Arab Emirates", fips: "AE" },
    { iso2: "SA", name: "Saudi Arabia", fips: "SA" },
  ];
  const db = getDb();
  for (const row of rows) {
    await db
      .insert(countryCodes)
      .values({ ...row, providerCodes: {} })
      .onConflictDoUpdate({
        target: countryCodes.iso2,
        set: { name: row.name, fips: row.fips },
      });
  }
}

async function seedSources() {
  const db = getDb();
  for (const queue of oneShotIngestionQueues) {
    const descriptors = await connectorDescriptorsForQueue(queue);
    for (const descriptor of descriptors) {
      const connector = descriptor.makeConnector(new RecordingFetchClient());
      await upsertSource(db, {
        key: descriptor.sourceKey,
        label: descriptor.label,
        capabilities: connector.capabilities(),
      });
    }
  }
}

async function seedCuratedEvents() {
  const db = getDb();
  const now = new Date();
  const seeds = await loadCuratedEventSeeds();
  const materialized = materializeCuratedEvents(seeds, {
    from: now,
    to: new Date(now.getTime() + 730 * DAY),
  });

  for (const event of materialized) {
    await db
      .insert(events)
      .values({
        externalKey: event.id,
        title: event.title,
        category: event.category,
        markets: event.markets,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
        timezone: event.timezone,
        datePrecision: event.datePrecision,
        confidence: event.confidence,
        sourceUrls: event.sourceUrls,
        recurrence: event.recurrence,
        createdBy: "curated-file",
        status: event.status,
        lastVerifiedAt: event.lastVerifiedAt,
      })
      .onConflictDoUpdate({
        target: events.externalKey,
        set: {
          title: event.title,
          category: event.category,
          markets: event.markets,
          startsAt: event.startsAt,
          sourceUrls: event.sourceUrls,
          confidence: event.confidence,
          lastVerifiedAt: event.lastVerifiedAt,
          updatedAt: new Date(),
        },
      });
  }
  return materialized.length;
}

async function main() {
  const db = getDb();
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  await seedSettings();
  await seedCountryCodes();
  await seedSources();
  const eventCount = await seedCuratedEvents();
  console.log(`Seeded settings, source registry, country mappings, and ${eventCount} curated events. No trend fixtures were inserted.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => closeDb());

