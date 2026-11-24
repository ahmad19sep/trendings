import { describe, expect, it } from "vitest";

import { AuthConfigurationError } from "./errors";
import { hashPassword, isArgon2idHash, verifyPassword } from "./password";

describe("password helpers", () => {
  it("creates and verifies Argon2id hashes", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(isArgon2idHash(hash)).toBe(true);
    await expect(
      verifyPassword(hash, "correct horse battery staple"),
    ).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("refuses non-Argon2id configuration", async () => {
    expect(isArgon2idHash("$argon2i$v=19$...")).toBe(false);
    await expect(verifyPassword("not-a-hash", "password")).rejects.toBeInstanceOf(
      AuthConfigurationError,
    );
  });
});

