import { isDatabaseConfigured } from "../../db/client";
import { getDb } from "../../db/client";
import { users } from "../../db/schema";

import { isArgon2idHash } from "./password";

export type AuthConfiguration = {
  readyForLogin: boolean;
  issues: string[];
  usesDatabase: boolean;
};

export async function getAuthConfiguration(): Promise<AuthConfiguration> {
  const issues: string[] = [];
  const hasDatabase = isDatabaseConfigured();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  let hasDatabaseUser = false;
  if (hasDatabase) {
    try {
      const [user] = await getDb().select({ id: users.id }).from(users).limit(1);
      hasDatabaseUser = Boolean(user);
    } catch {
      issues.push(
        "The database is unavailable or has not been migrated. Complete database setup before signing in.",
      );
    }
  }

  if (!hasDatabaseUser && !isArgon2idHash(passwordHash)) {
    issues.push(
      "Set ADMIN_PASSWORD_HASH to an Argon2id hash before the first sign-in.",
    );
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    issues.push("Set SESSION_SECRET to a random value of at least 32 characters.");
  }

  return {
    readyForLogin: issues.length === 0,
    issues,
    usesDatabase: hasDatabase,
  };
}

