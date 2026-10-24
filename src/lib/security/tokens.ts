import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Microsite tokens are 256-bit random values encoded as base64url (43 chars).
 * The database stores:
 *  - token_hash: SHA-256 hex, used for every public lookup;
 *  - token_ciphertext: AES-256-GCM encryption of the token, so an agent can copy
 *    the link again later. The key exists only in the server environment.
 */

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export function generateMicrositeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isWellFormedToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export class TokenSecretError extends Error {}

function keyFrom(secret: string | undefined): Buffer {
  if (!secret) throw new TokenSecretError("MICROSITE_TOKEN_SECRET is not set");
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new TokenSecretError("MICROSITE_TOKEN_SECRET must be 32 random bytes, base64-encoded (openssl rand -base64 32)");
  }
  return key;
}

export function encryptToken(token: string, secret: string | undefined): string {
  const key = keyFrom(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptToken(payload: string, secret: string | undefined): string {
  const key = keyFrom(secret);
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Unrecognised token ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
