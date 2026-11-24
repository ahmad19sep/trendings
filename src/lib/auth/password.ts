import argon2 from "argon2";

import { AuthConfigurationError } from "./errors";

export function isArgon2idHash(value: string | undefined): value is string {
  return Boolean(value?.startsWith("$argon2id$"));
}

export async function verifyPassword(
  encodedHash: string,
  password: string,
): Promise<boolean> {
  if (!isArgon2idHash(encodedHash)) {
    throw new AuthConfigurationError(
      "The configured administrator password is not an Argon2id hash.",
    );
  }

  try {
    return await argon2.verify(encodedHash, password);
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
}

