import { createHash, randomBytes } from "node:crypto";

// How long an emailed link stays valid.
export const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
export const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

/** A high-entropy URL-safe token. The raw value only ever lives in the email. */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** What we store/look up by — the raw token is never persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function expiryFromNow(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}
