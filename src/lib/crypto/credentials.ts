import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface EncryptedCredential {
  ciphertext: string;
  iv: string;
  authTag: string;
  lastFour: string;
}

function encryptionKey(value = process.env.APP_ENCRYPTION_KEY): Buffer {
  if (!value) {
    throw new Error("APP_ENCRYPTION_KEY is required to store credentials.");
  }
  const encoding = /^[0-9a-f]{64}$/i.test(value) ? "hex" : "base64";
  const key = Buffer.from(value, encoding);
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

export function encryptCredential(
  credentialName: string,
  plaintext: string,
  keyValue?: string,
): EncryptedCredential {
  if (!credentialName.trim()) throw new Error("Credential name is required.");
  if (!plaintext) throw new Error("Credential value is required.");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyValue), iv);
  cipher.setAAD(Buffer.from(credentialName, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    lastFour: plaintext.slice(-4),
  };
}

export function decryptCredential(
  credentialName: string,
  encrypted: Pick<EncryptedCredential, "ciphertext" | "iv" | "authTag">,
  keyValue?: string,
): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(keyValue),
    Buffer.from(encrypted.iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(credentialName, "utf8"));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

