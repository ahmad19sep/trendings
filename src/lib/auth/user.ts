import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "../../db/client";
import { users } from "../../db/schema";

import { ENV_USER_ID } from "./constants";
import { AuthConfigurationError, InvalidCredentialsError } from "./errors";
import { isArgon2idHash, verifyPassword } from "./password";

export type AuthUser = {
  id: string;
  displayName: string;
};

type UserWithHash = AuthUser & { passwordHash: string };

async function firstDatabaseUser(): Promise<UserWithHash | null> {
  if (!isDatabaseConfigured()) return null;
  const [user] = await getDb().select().from(users).limit(1);
  return user ?? null;
}

async function bootstrapDatabaseUser(
  passwordHash: string,
): Promise<UserWithHash> {
  const db = getDb();
  const existing = await firstDatabaseUser();
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      displayName: process.env.ADMIN_DISPLAY_NAME?.trim() || "Ahmad",
      passwordHash,
    })
    .returning();

  if (!created) {
    throw new AuthConfigurationError("Unable to create the administrator user.");
  }

  return created;
}

export async function authenticatePassword(password: string): Promise<AuthUser> {
  const databaseUser = await firstDatabaseUser();
  const environmentHash = process.env.ADMIN_PASSWORD_HASH;
  const passwordHash = databaseUser?.passwordHash ?? environmentHash;

  if (!passwordHash || !isArgon2idHash(passwordHash)) {
    throw new AuthConfigurationError(
      "Configure an Argon2id administrator password hash before signing in.",
    );
  }

  if (!(await verifyPassword(passwordHash, password))) {
    throw new InvalidCredentialsError();
  }

  if (databaseUser) {
    return {
      id: databaseUser.id,
      displayName: databaseUser.displayName,
    };
  }

  if (isDatabaseConfigured()) {
    const user = await bootstrapDatabaseUser(passwordHash);
    return { id: user.id, displayName: user.displayName };
  }

  return {
    id: ENV_USER_ID,
    displayName: process.env.ADMIN_DISPLAY_NAME?.trim() || "Ahmad",
  };
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  if (!isDatabaseConfigured()) {
    if (id !== ENV_USER_ID) return null;
    return {
      id,
      displayName: process.env.ADMIN_DISPLAY_NAME?.trim() || "Ahmad",
    };
  }

  const [user] = await getDb()
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
}

