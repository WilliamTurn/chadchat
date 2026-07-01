import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_PATH } from "@/lib/admin";

/**
 * Passphrase gate for the admin panel (NAV-34). A second, independent lock on
 * top of the email allowlist (`isAdminEmail`) and the obscure URL (NAV-33):
 * even a signed-in admin must enter a shared secret before the panel — which
 * can delete users — will render or run any privileged action.
 *
 * How it works: the raw passphrase (`ADMIN_PANEL_SECRET`) never touches the
 * browser. On unlock we store a one-way hash of it in an httpOnly cookie; every
 * request re-derives the expected hash and timing-safe compares. If the env var
 * is unset the panel fails CLOSED (nobody can unlock) rather than open.
 */

export const PANEL_COOKIE = "chad_admin_panel";
// Re-enter the passphrase at least this often (session-length lock).
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

/** The configured secret, trimmed, or null when unset/blank. */
function secret(): string | null {
  const s = process.env.ADMIN_PANEL_SECRET?.trim();
  return s ? s : null;
}

/** True when a passphrase has been configured at all. */
export function isPanelConfigured(): boolean {
  return secret() !== null;
}

/**
 * One-way token derived from a passphrase. This is what lives in the cookie,
 * so the cookie can't be reversed into the passphrase and is useless off-site.
 */
function tokenFor(passphrase: string): string {
  return createHash("sha256").update(`chad-admin:${passphrase}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Compare same-length buffers (sha256 hex is always 64 chars, but guard anyway).
  if (ab.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** True if a submitted passphrase matches the configured secret. */
export function checkPanelSecret(input: string): boolean {
  const s = secret();
  if (!s) {
    return false;
  }
  return safeEqual(tokenFor(input), tokenFor(s));
}

/** True if the current request already holds a valid unlock cookie. */
export async function isPanelUnlocked(): Promise<boolean> {
  const s = secret();
  if (!s) {
    return false; // fail closed: an unconfigured panel stays locked
  }
  const jar = await cookies();
  const got = jar.get(PANEL_COOKIE)?.value;
  if (!got) {
    return false;
  }
  return safeEqual(got, tokenFor(s));
}

/** Set the unlock cookie (called only after the passphrase is verified). */
export async function setPanelCookie(): Promise<void> {
  const s = secret();
  if (!s) {
    return;
  }
  const jar = await cookies();
  jar.set(PANEL_COOKIE, tokenFor(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Scope to the admin base so the cookie is never sent on normal traffic.
    path: ADMIN_PATH,
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Clear the unlock cookie (the "Lock panel" action). */
export async function clearPanelCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(PANEL_COOKIE, "", { path: ADMIN_PATH, maxAge: 0 });
}
