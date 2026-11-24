import { describe, expect, it } from "vitest";

import { decryptCredential, encryptCredential } from "./credentials";

const key = Buffer.alloc(32, 7).toString("base64");

describe("credential encryption", () => {
  it("round-trips with AES-256-GCM and retains only the last four for display", () => {
    const encrypted = encryptCredential("youtube", "secret-value-1234", key);
    expect(encrypted.ciphertext).not.toContain("secret-value");
    expect(encrypted.lastFour).toBe("1234");
    expect(decryptCredential("youtube", encrypted, key)).toBe("secret-value-1234");
  });

  it("binds ciphertext to the credential name", () => {
    const encrypted = encryptCredential("youtube", "secret-value", key);
    expect(() => decryptCredential("tmdb", encrypted, key)).toThrow();
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => encryptCredential("youtube", "secret", "too-short")).toThrow(
      /32 bytes/,
    );
  });
});

