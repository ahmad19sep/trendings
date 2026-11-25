import { lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDb } from "../db/client";
import * as schema from "../db/schema";

type Database = NodePgDatabase<typeof schema>;
type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
type DatabaseExecutor = Database | DatabaseTransaction;

const DAY = 24 * 60 * 60 * 1000;

export interface RetentionResult {
  rawPayloads: number;
  items: number;
  snapshots: number;
  topics: number;
  aiCache: number;
  sessions: number;
}

export async function runRetention(
  db: DatabaseExecutor = getDb(),
  now = new Date(),
): Promise<RetentionResult> {
  const itemCutoff = new Date(now.getTime() - 90 * DAY);
  const historyCutoff = new Date(now.getTime() - 365 * DAY);

  const [rawPayloads, snapshots, items, topics, aiCache, sessions] =
    await db.transaction(async (tx) => {
      const removedRaw = await tx
        .delete(schema.rawPayloads)
        .where(lt(schema.rawPayloads.expiresAt, now))
        .returning({ id: schema.rawPayloads.id });
      const removedSnapshots = await tx
        .delete(schema.topicSnapshots)
        .where(lt(schema.topicSnapshots.observedAt, historyCutoff))
        .returning({ id: schema.topicSnapshots.id });
      const removedItems = await tx
        .delete(schema.items)
        .where(lt(schema.items.lastSeenAt, itemCutoff))
        .returning({ id: schema.items.id });
      // Bookmark rows use ON DELETE SET NULL, so notes and tags survive the
      // provider-data retention boundary as required.
      const removedTopics = await tx
        .delete(schema.topics)
        .where(lt(schema.topics.lastActivityAt, historyCutoff))
        .returning({ id: schema.topics.id });
      const removedAiCache = await tx
        .delete(schema.aiCache)
        .where(lt(schema.aiCache.expiresAt, now))
        .returning({ key: schema.aiCache.key });
      const removedSessions = await tx
        .delete(schema.sessions)
        .where(lt(schema.sessions.expiresAt, now))
        .returning({ id: schema.sessions.id });
      return [
        removedRaw.length,
        removedSnapshots.length,
        removedItems.length,
        removedTopics.length,
        removedAiCache.length,
        removedSessions.length,
      ] as const;
    });

  return {
    rawPayloads,
    items,
    snapshots,
    topics,
    aiCache,
    sessions,
  };
}

