import { randomUUID } from "node:crypto";

import { eq, TransactionRollbackError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "../db/client";
import * as schema from "../db/schema";

import { runRetention } from "./retention";

const DAY = 24 * 60 * 60 * 1_000;
const acceptanceEnabled =
  process.env.RUN_DATABASE_ACCEPTANCE === "1" &&
  Boolean(process.env.DATABASE_URL);

describe.skipIf(!acceptanceEnabled)("database retention acceptance", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("deletes every expired category in a savepoint and preserves bookmark data", async () => {
    const db = getDb();
    const marker = randomUUID();
    // Keeping the synthetic clock well before real application data prevents
    // the rollback-only test from locking current rows unnecessarily.
    const now = new Date("2000-01-01T00:00:00.000Z");
    const rollback = db.transaction(async (tx) => {
      const [source] = await tx
        .insert(schema.sources)
        .values({
          key: `retention-acceptance:${marker}`,
          name: `Retention acceptance ${marker}`,
        })
        .returning({ id: schema.sources.id });
      if (!source) throw new Error("Could not create the retention test source.");

      const [expiredRaw, freshRaw] = await tx
        .insert(schema.rawPayloads)
        .values([
          {
            sourceId: source.id,
            bodyCompressed: "expired",
            contentHash: `expired:${marker}`,
            expiresAt: new Date(now.getTime() - DAY),
          },
          {
            sourceId: source.id,
            bodyCompressed: "fresh",
            contentHash: `fresh:${marker}`,
            expiresAt: new Date(now.getTime() + DAY),
          },
        ])
        .returning({ id: schema.rawPayloads.id });

      const [expiredItem, freshItem] = await tx
        .insert(schema.items)
        .values([
          {
            sourceId: source.id,
            connector: "retention-acceptance",
            externalId: `expired:${marker}`,
            url: `https://example.test/expired/${marker}`,
            language: "en",
            titleOriginal: "Expired retention sentinel",
            lastSeenAt: new Date(now.getTime() - 91 * DAY),
            parserVersion: "retention-acceptance-v1",
          },
          {
            sourceId: source.id,
            connector: "retention-acceptance",
            externalId: `fresh:${marker}`,
            url: `https://example.test/fresh/${marker}`,
            language: "en",
            titleOriginal: "Fresh retention sentinel",
            lastSeenAt: new Date(now.getTime() - 89 * DAY),
            parserVersion: "retention-acceptance-v1",
          },
        ])
        .returning({ id: schema.items.id });

      const [expiredTopic] = await tx
        .insert(schema.topics)
        .values({
          titleOriginal: "Expired retention topic",
          primaryCategory: "other",
          firstSeenAt: new Date(now.getTime() - 367 * DAY),
          lastActivityAt: new Date(now.getTime() - 366 * DAY),
        })
        .returning({ id: schema.topics.id });
      const [freshTopic] = await tx
        .insert(schema.topics)
        .values({
          titleOriginal: "Fresh retention topic",
          primaryCategory: "other",
          firstSeenAt: new Date(now.getTime() - 364 * DAY),
          lastActivityAt: new Date(now.getTime() - 364 * DAY),
        })
        .returning({ id: schema.topics.id });
      if (!expiredTopic || !freshTopic) {
        throw new Error("Could not create retention test topics.");
      }

      const [expiredSnapshot, freshSnapshot] = await tx
        .insert(schema.topicSnapshots)
        .values([
          {
            topicId: freshTopic.id,
            observedAt: new Date(now.getTime() - 366 * DAY),
          },
          {
            topicId: freshTopic.id,
            observedAt: new Date(now.getTime() - 364 * DAY),
          },
        ])
        .returning({ id: schema.topicSnapshots.id });

      const expiredCacheKey = `retention-expired:${marker}`;
      const freshCacheKey = `retention-fresh:${marker}`;
      await tx.insert(schema.aiCache).values([
        {
          key: expiredCacheKey,
          task: "retention-acceptance",
          model: "none",
          value: { marker },
          expiresAt: new Date(now.getTime() - DAY),
        },
        {
          key: freshCacheKey,
          task: "retention-acceptance",
          model: "none",
          value: { marker },
          expiresAt: new Date(now.getTime() + DAY),
        },
      ]);

      const [user] = await tx
        .insert(schema.users)
        .values({
          displayName: `Retention acceptance ${marker}`,
          passwordHash: "rollback-only",
        })
        .returning({ id: schema.users.id });
      if (!user) throw new Error("Could not create the retention test user.");

      const [expiredSession, freshSession] = await tx
        .insert(schema.sessions)
        .values([
          {
            userId: user.id,
            tokenHash: `expired:${marker}`,
            expiresAt: new Date(now.getTime() - DAY),
          },
          {
            userId: user.id,
            tokenHash: `fresh:${marker}`,
            expiresAt: new Date(now.getTime() + DAY),
          },
        ])
        .returning({ id: schema.sessions.id });

      const [bookmark] = await tx
        .insert(schema.bookmarks)
        .values({
          topicId: expiredTopic.id,
          notes: `retention-note:${marker}`,
          tags: ["retention", marker],
          scoreSnapshot: { marker, score: 42 },
        })
        .returning({ id: schema.bookmarks.id });
      if (!bookmark) throw new Error("Could not create the retention test bookmark.");

      const result = await runRetention(tx, now);

      for (const count of Object.values(result)) {
        expect(count).toBeGreaterThanOrEqual(1);
      }

      // Explicit per-table checks keep the sentinel assertions type-safe while
      // proving that fresh rows survive each strict retention boundary.
      expect(
        await tx.select().from(schema.rawPayloads).where(eq(schema.rawPayloads.id, expiredRaw!.id)),
      ).toEqual([]);
      expect(
        await tx.select().from(schema.rawPayloads).where(eq(schema.rawPayloads.id, freshRaw!.id)),
      ).toHaveLength(1);
      expect(
        await tx.select().from(schema.items).where(eq(schema.items.id, expiredItem!.id)),
      ).toEqual([]);
      expect(
        await tx.select().from(schema.items).where(eq(schema.items.id, freshItem!.id)),
      ).toHaveLength(1);
      expect(
        await tx.select().from(schema.topicSnapshots).where(eq(schema.topicSnapshots.id, expiredSnapshot!.id)),
      ).toEqual([]);
      expect(
        await tx.select().from(schema.topicSnapshots).where(eq(schema.topicSnapshots.id, freshSnapshot!.id)),
      ).toHaveLength(1);
      expect(
        await tx.select().from(schema.topics).where(eq(schema.topics.id, expiredTopic.id)),
      ).toEqual([]);
      expect(
        await tx.select().from(schema.topics).where(eq(schema.topics.id, freshTopic.id)),
      ).toHaveLength(1);
      expect(
        await tx.select().from(schema.aiCache).where(eq(schema.aiCache.key, expiredCacheKey)),
      ).toEqual([]);
      expect(
        await tx.select().from(schema.aiCache).where(eq(schema.aiCache.key, freshCacheKey)),
      ).toHaveLength(1);
      expect(
        await tx.select().from(schema.sessions).where(eq(schema.sessions.id, expiredSession!.id)),
      ).toEqual([]);
      expect(
        await tx.select().from(schema.sessions).where(eq(schema.sessions.id, freshSession!.id)),
      ).toHaveLength(1);

      const [preservedBookmark] = await tx
        .select({
          topicId: schema.bookmarks.topicId,
          notes: schema.bookmarks.notes,
          tags: schema.bookmarks.tags,
          scoreSnapshot: schema.bookmarks.scoreSnapshot,
        })
        .from(schema.bookmarks)
        .where(eq(schema.bookmarks.id, bookmark.id));
      expect(preservedBookmark).toEqual({
        topicId: null,
        notes: `retention-note:${marker}`,
        tags: ["retention", marker],
        scoreSnapshot: { marker, score: 42 },
      });

      // This deliberately aborts the outer transaction after the nested
      // runRetention savepoint and all assertions have completed.
      tx.rollback();
    });

    await expect(rollback).rejects.toBeInstanceOf(TransactionRollbackError);
    expect(
      await db
        .select({ id: schema.sources.id })
        .from(schema.sources)
        .where(eq(schema.sources.key, `retention-acceptance:${marker}`)),
    ).toEqual([]);
  }, 30_000);
});
