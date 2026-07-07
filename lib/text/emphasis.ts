/*
 * Chad's emphasis syntax, shared by every channel that renders his writing
 * outside the chat stream (s157, owner order: the emails carry his FULL
 * voice). The syntax is the one his chat FORMATTING rules already use:
 * **bold** for hard emphasis, [[double brackets]] for his rare red
 * non-negotiables (red renders bold automatically), ALL CAPS passes through
 * as plain text. No "server-only": the email templates (server), the
 * /reports view (server), the PDF exporter (client), and the share cards
 * (client) all use it.
 */

const BOLD_RE = /\*\*([^*]+)\*\*/g;
const RED_RE = /\[\[([^\]]+)\]\]/g;

/** Escape text for safe interpolation into HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert Chad's emphasis markers in ALREADY-ESCAPED text to HTML. `red`
 * decides the markup for [[...]] — inline styles for email clients, the
 * app's .chad-red class in the app.
 */
function emphasisToHtml(
  escaped: string,
  red: (inner: string) => string
): string {
  return escaped
    .replace(RED_RE, (_, inner: string) => red(inner))
    .replace(BOLD_RE, (_, inner: string) => `<strong>${inner}</strong>`);
}

/** Escape + emphasize for the email templates (inline styles only). */
export function chadEmailHtml(text: string): string {
  return emphasisToHtml(
    escapeHtml(text),
    (inner) =>
      `<span style="color:#ff453a;font-weight:700;">${inner}</span>`
  );
}

/** Escape + emphasize for in-app rendering (uses the chat's .chad-red). */
export function chadAppHtml(text: string): string {
  return emphasisToHtml(
    escapeHtml(text),
    (inner) => `<span class="chad-red">${inner}</span>`
  );
}

/** Drop the markers for plain-text surfaces (PDF, share cards, prefills). */
export function stripEmphasis(text: string): string {
  return text.replace(RED_RE, "$1").replace(BOLD_RE, "$1");
}
