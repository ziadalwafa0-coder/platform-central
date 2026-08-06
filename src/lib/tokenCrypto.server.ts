// AES-256-GCM encryption for third-party API tokens.
// Server-only. Never import from client code, never log plaintext tokens.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

function key(): Buffer {
  const raw = process.env["TAGER_TOKEN_SECRET"];
  if (!raw) throw new Error("token_crypto:missing_secret");
  // Secret is a random alphanumeric string; derive a stable 32-byte key from it.
  return createHash("sha256").update(raw, "utf8").digest();
}

/** Encrypts a token into an opaque base64 blob: iv | authTag | ciphertext. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

/** Reverses {@link encryptToken}. Throws on tampering or wrong key. */
export function decryptToken(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Safe, non-reversible hint for UI/logs, e.g. "abcd…7f21". */
export function tokenHint(plaintext: string): string {
  if (plaintext.length <= 8) return "•".repeat(plaintext.length);
  return `${plaintext.slice(0, 4)}…${plaintext.slice(-4)}`;
}
